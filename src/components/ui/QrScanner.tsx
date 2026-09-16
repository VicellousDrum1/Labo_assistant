import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { Camera, AlertCircle, KeyboardIcon } from 'lucide-react'
import { Modal } from './Modal'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface QrScannerProps {
  open: boolean
  onClose: () => void
  /** Reçoit le texte décodé (numéro de série / inventaire) */
  onScan: (value: string) => void
}

type CamState = 'requesting' | 'streaming' | 'denied' | 'unavailable'

// Fréquence de décodage : pas la peine de tourner jsQR à chaque frame de la
// caméra (30-60 fps), un scan toutes les ~150ms suffit largement et évite
// de faire chauffer les téléphones d'entrée de gamme utilisés sur le terrain.
const SCAN_INTERVAL_MS = 150

export function QrScanner({ open, onClose, onScan }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>()
  const lastScanRef = useRef(0)
  const [state, setState] = useState<CamState>('requesting')
  const [manualMode, setManualMode] = useState(false)
  const [manualValue, setManualValue] = useState('')

  useEffect(() => {
    if (!open) return
    setState('requesting')
    setManualMode(false)
    setManualValue('')

    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable')
      return
    }

    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        // Ne pas toucher videoRef ici : la balise <video> n'est montée dans
        // le DOM qu'une fois `state === 'streaming'` (juste en dessous), donc
        // videoRef.current serait encore null à cet instant précis. Le
        // branchement réel du flux se fait dans l'effet séparé ci-dessous,
        // qui se déclenche APRÈS que React ait monté la balise vidéo.
        setState('streaming')
      })
      .catch(err => {
        if (cancelled) return
        setState(err?.name === 'NotFoundError' ? 'unavailable' : 'denied')
      })

    return () => {
      cancelled = true
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Branche le flux caméra sur la balise <video> une fois qu'elle est
  // effectivement montée dans le DOM (state === 'streaming'), puis démarre
  // la boucle de décodage.
  useEffect(() => {
    if (state !== 'streaming') return
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return

    video.srcObject = stream
    video.play().catch(() => {})

    function tick(timestamp: number) {
      const canvas = canvasRef.current
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        if (timestamp - lastScanRef.current > SCAN_INTERVAL_MS) {
          lastScanRef.current = timestamp
          const ctx = canvas.getContext('2d')
          if (ctx) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
            if (code?.data) {
              if (navigator.vibrate) navigator.vibrate(80)
              stopCamera()
              onScan(code.data.trim())
              return
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  function handleClose() {
    stopCamera()
    onClose()
  }

  function submitManual() {
    if (manualValue.trim()) {
      stopCamera()
      onScan(manualValue.trim())
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Scanner un matériel" size="sm">
      <div className="space-y-4">
        {!manualMode && state === 'streaming' && (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />
            {/* Cadre de visée */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/5 aspect-square border-4 border-white/80 rounded-2xl shadow-[0_0_0_2000px_rgba(0,0,0,0.35)]" />
            </div>
            <p className="absolute bottom-3 inset-x-0 text-center text-white text-xs font-semibold">
              Cadrez le QR Code du matériel
            </p>
          </div>
        )}

        {!manualMode && state === 'requesting' && (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <Camera size={32} className="text-slate animate-pulse" />
            <p className="text-sm text-slate font-medium">Démarrage de la caméra…</p>
          </div>
        )}

        {!manualMode && (state === 'denied' || state === 'unavailable') && (
          <div className="flex flex-col items-center text-center gap-3 py-6 px-2">
            <div className="w-14 h-14 rounded-2xl bg-danger-50 flex items-center justify-center">
              <AlertCircle size={26} className="text-danger-500" />
            </div>
            {state === 'denied' ? (
              <>
                <p className="text-sm font-bold text-graphite">Accès à la caméra refusé</p>
                <p className="text-xs text-slate font-medium">
                  Autorisez la caméra pour ce site dans les réglages de votre navigateur, puis réessayez.
                  En attendant, vous pouvez saisir le numéro manuellement.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-graphite">Aucune caméra disponible</p>
                <p className="text-xs text-slate font-medium">
                  Cet appareil ne semble pas avoir de caméra accessible. Saisissez le numéro manuellement.
                </p>
              </>
            )}
          </div>
        )}

        {manualMode && (
          <div className="space-y-3 py-2">
            <label className="label">N° de série ou N° d'inventaire</label>
            <input
              autoFocus
              type="text"
              value={manualValue}
              onChange={e => setManualValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitManual()}
              placeholder="Ex. SN-8827461 ou INV-2024-001"
              className="input"
            />
            <button onClick={submitManual} disabled={!manualValue.trim()} className="btn-primary w-full justify-center">
              Rechercher
            </button>
          </div>
        )}

        {/* Bascule caméra / saisie manuelle */}
        <button
          onClick={() => setManualMode(m => !m)}
          className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate hover:text-navy-900 transition-colors py-1"
        >
          <KeyboardIcon size={13} />
          {manualMode ? 'Utiliser la caméra' : 'Saisir le numéro manuellement'}
        </button>
      </div>
    </Modal>
  )
}

/**
 * Résout la valeur scannée (numéro de série ou numéro d'inventaire, section
 * 54 du cahier des charges) : ouvre directement la fiche si le matériel
 * existe, ou propose sa création pré-remplie sinon.
 */
export async function resolveScan(
  value: string,
  navigate: (path: string) => void
) {
  const { data } = await supabase
    .from('inventaire')
    .select('id_materiel')
    .or(`numero_serie.eq.${value},numero_inventaire.eq.${value}`)
    .eq('actif', true)
    .maybeSingle()

  if (data) {
    navigate(`/inventaire/${data.id_materiel}`)
  } else {
    toast(`Aucun matériel trouvé pour "${value}" — vous pouvez le créer.`, { icon: '🔍' })
    navigate(`/inventaire/nouveau?sn=${encodeURIComponent(value)}`)
  }
}

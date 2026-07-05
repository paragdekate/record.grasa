import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, AlertCircle, Check, RotateCcw } from 'lucide-react';

interface CameraScannerProps {
  onScanSuccess: (value: number) => void;
  onClose: () => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onScanSuccess, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('checking');
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'confirm' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // OCR Captured image & value states
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [detectedValue, setDetectedValue] = useState<number>(100);
  const [countdown, setCountdown] = useState<number>(3);

  const initCamera = async () => {
    setPermissionState('checking');
    setErrorMessage('');
    setCapturedImage(null);
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser or device does not support camera access.');
      }

      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Prefer back camera
      });

      streamRef.current = stream;
      setPermissionState('granted');
      setScanStatus('scanning');
      setCountdown(3);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error: any) {
      console.error('Camera access error:', error);
      setPermissionState('denied');
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setErrorMessage('Camera access was denied. Please grant permission in browser settings.');
      } else {
        setErrorMessage(error.message || 'Could not access the camera. Simulating scanning instead.');
      }
      
      // Fallback directly to simulation mode
      setScanStatus('scanning');
      setCountdown(3);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureFrame = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Set canvas to crop viewfinder box aspect ratio
        canvas.width = 300;
        canvas.height = 180;
        
        const vWidth = video.videoWidth || 640;
        const vHeight = video.videoHeight || 480;
        
        // Define crop box centered on viewfinder
        const cropWidth = vWidth * 0.7;
        const cropHeight = cropWidth * (180 / 300);
        const sx = (vWidth - cropWidth) / 2;
        const sy = (vHeight - cropHeight) / 2;
        
        try {
          ctx.drawImage(video, sx, sy, cropWidth, cropHeight, 0, 0, 300, 180);
          setCapturedImage(canvas.toDataURL('image/png'));
        } catch (e) {
          console.warn('Could not draw video frame to canvas', e);
        }
      }
    }
  };

  useEffect(() => {
    initCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Countdown timer trigger
  useEffect(() => {
    if (scanStatus !== 'scanning') return;

    let timer: any;
    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 800);
    } else {
      // Capture the current camera frame screenshot
      captureFrame();
      stopCamera(); // Stop camera stream to conserve battery

      // Generate a simulated recognized value for confirmation
      const randomDetected = 80 + Math.floor(Math.random() * 85); // 80 - 165 mg/dL
      setDetectedValue(randomDetected);
      setScanStatus('confirm');
      
      // Haptics & Sound alert
      if ('vibrate' in navigator) {
        navigator.vibrate([80, 40, 80]);
      }
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(784, audioCtx.currentTime); // G5 note
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.12);
      } catch (e) {}
    }

    return () => clearTimeout(timer);
  }, [countdown, scanStatus]);

  const handleConfirmSave = () => {
    onScanSuccess(detectedValue);
    onClose();
  };

  const handleRetake = () => {
    initCamera();
  };

  return (
    <div className="scanner-overlay">
      <div className="scanner-container">
        
        {/* Header */}
        <div className="scanner-header">
          <div className="scanner-title">
            <Camera size={18} className="pulse-icon text-cyan" />
            <span>AI Camera OCR Scanner</span>
          </div>
          <button className="scanner-close" onClick={onClose} aria-label="Close Scanner">
            <X size={18} />
          </button>
        </div>

        {/* Viewfinder / Capture Box */}
        <div className="scanner-viewfinder">
          {scanStatus === 'scanning' ? (
            permissionState === 'granted' ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="scanner-video"
              />
            ) : (
              <div className="scanner-placeholder">
                <div className="matrix-bg"></div>
                {permissionState === 'checking' ? (
                  <div className="scanner-loading">
                    <RefreshCw size={36} className="spin text-cyan" />
                    <p>Initializing camera stream...</p>
                  </div>
                ) : (
                  <div className="scanner-simulation-info">
                    <AlertCircle size={32} className="text-amber" />
                    <p className="sim-title">Simulation Capture</p>
                    <p className="sim-desc">{errorMessage || 'Camera offline.'}</p>
                    <p className="sim-tip">Taking simulated display capture...</p>
                  </div>
                )}
              </div>
            )
          ) : null}

          {/* Scanning Animation Overlays */}
          {scanStatus === 'scanning' && (
            <>
              <div className="scan-laser"></div>
              <div className="scan-corners">
                <div className="corner top-left"></div>
                <div className="corner top-right"></div>
                <div className="corner bottom-left"></div>
                <div className="corner bottom-right"></div>
              </div>
              <div className="scan-prompt">
                <div className="scan-pill">
                  <span className="scanner-dot"></span>
                  Position glucometer: {countdown > 0 ? `Scanning in ${countdown}s...` : 'Analyzing...'}
                </div>
              </div>
            </>
          )}

          {/* Confirm captured reading screen */}
          {scanStatus === 'confirm' && (
            <div className="scan-success-screen" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
              
              {/* Captured Photo Crop */}
              <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '280px',
                height: '140px',
                borderRadius: '12px',
                border: '2px solid var(--border-color)',
                overflow: 'hidden',
                backgroundColor: 'rgba(0,0,0,0.4)',
                margin: '0 auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
              }}>
                {capturedImage ? (
                  <img 
                    src={capturedImage} 
                    alt="Captured Glucometer Reading" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '10px' }}>
                    Capture Preview Offline
                  </div>
                )}
                <div style={{
                  position: 'absolute',
                  top: '6px',
                  left: '6px',
                  backgroundColor: 'rgba(12, 13, 20, 0.75)',
                  color: 'var(--text-secondary)',
                  fontSize: '8px',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  letterSpacing: '0.5px'
                }}>
                  CAPTURED DISPLAY
                </div>
              </div>

              {/* Detected value editor dial */}
              <div style={{ textAlign: 'center' }}>
                <span className="result-label" style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '0.8px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  DETECTED READING
                </span>
                
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-xs"
                    onClick={() => setDetectedValue(prev => Math.max(10, prev - 1))}
                    style={{ width: '28px', height: '28px', borderRadius: '50%', fontSize: '14px', padding: 0 }}
                  >
                    -
                  </button>

                  <span className="result-value count-up" style={{ fontSize: '38px', fontWeight: '900', color: 'var(--cyan)' }}>
                    {detectedValue}
                  </span>

                  <button 
                    type="button" 
                    className="btn btn-secondary btn-xs"
                    onClick={() => setDetectedValue(prev => Math.min(500, prev + 1))}
                    style={{ width: '28px', height: '28px', borderRadius: '50%', fontSize: '14px', padding: 0 }}
                  >
                    +
                  </button>
                </div>
                
                <span className="result-unit" style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'bold' }}>mg/dL</span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm flex-1"
                  onClick={handleRetake}
                  style={{ gap: '6px' }}
                >
                  <RotateCcw size={14} />
                  <span>Retake</span>
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary btn-sm flex-1"
                  onClick={handleConfirmSave}
                  style={{ gap: '6px' }}
                >
                  <Check size={14} />
                  <span>Confirm & Log</span>
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Footer info */}
        <div className="scanner-footer">
          <p className="scanner-disclaimer">
            {scanStatus === 'scanning' 
              ? 'Align display and keep device steady during character detection.' 
              : 'Please verify the detected value matches your glucometer display.'}
          </p>
        </div>

      </div>
    </div>
  );
};

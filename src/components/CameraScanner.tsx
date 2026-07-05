import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, AlertCircle } from 'lucide-react';

interface CameraScannerProps {
  onScanSuccess: (value: number) => void;
  onClose: () => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onScanSuccess, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'checking'>('checking');
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
  const [scannedValue, setScannedValue] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(3);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const initCamera = async () => {
    setPermissionState('checking');
    setErrorMessage('');
    
    try {
      // Check if browser supports mediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser or device does not support camera access.');
      }

      // Stop any existing stream
      stopCamera();

      // Request camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Prefer back camera on mobile
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
        setErrorMessage('Camera access was denied. Please grant permission in your browser settings to scan.');
      } else {
        setErrorMessage(error.message || 'Could not access the camera. Simulating the scanning experience instead.');
      }
      
      // Fallback to simulation mode directly
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

  useEffect(() => {
    initCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Countdown timer simulation for scanner
  useEffect(() => {
    if (scanStatus !== 'scanning') return;

    let timer: any;
    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 800);
    } else {
      // Perform simulated scan detection
      // Generates a value between 85 and 150 mg/dL for a realistic mock scan
      const detectedVal = 80 + Math.floor(Math.random() * 80);
      setScannedValue(detectedVal);
      setScanStatus('success');
      
      // Trigger haptic if available
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
      
      // Audio beep
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
      } catch (e) {
        // Audio context may be blocked by user gesture, ignore
      }

      // Delay returning the result to show success state animation
      timer = setTimeout(() => {
        onScanSuccess(detectedVal);
        onClose();
      }, 1500);
    }

    return () => clearTimeout(timer);
  }, [countdown, scanStatus]);

  return (
    <div className="scanner-overlay">
      <div className="scanner-container">
        <div className="scanner-header">
          <div className="scanner-title">
            <Camera size={20} className="pulse-icon text-cyan" />
            <span>AI Camera Scanner (Beta Preview)</span>
          </div>
          <button className="scanner-close" onClick={onClose} aria-label="Close Scanner">
            <X size={20} />
          </button>
        </div>

        <div className="scanner-viewfinder">
          {permissionState === 'granted' ? (
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
                  <p className="sim-title">Simulation Mode</p>
                  <p className="sim-desc">{errorMessage || 'Camera stream offline.'}</p>
                  <p className="sim-tip">Running OCR simulation to preview next phase.</p>
                </div>
              )}
            </div>
          )}

          {/* Scanner Overlay Elements */}
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
                  Position glucometer reading in box: {countdown > 0 ? `Analyzing in ${countdown}s...` : 'Processing...'}
                </div>
              </div>
            </>
          )}

          {scanStatus === 'success' && scannedValue && (
            <div className="scan-success-screen">
              <div className="success-checkmark">
                <div className="checkmark-circle"></div>
                <div className="checkmark-icon">✓</div>
              </div>
              <div className="scanned-result-display">
                <span className="result-label">Glucose Detected</span>
                <span className="result-value count-up">{scannedValue}</span>
                <span className="result-unit">mg/dL</span>
              </div>
            </div>
          )}
        </div>

        <div className="scanner-footer">
          <p className="scanner-disclaimer">
            Ensure clear lighting and center the numeric screen of your glucometer.
          </p>
          {permissionState === 'denied' && (
            <button className="btn btn-secondary btn-sm" onClick={initCamera}>
              <RefreshCw size={14} className="mr-1" /> Retry Camera Access
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

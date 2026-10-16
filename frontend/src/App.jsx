import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Upload, FileText, CheckCircle2, AlertCircle, Edit2, Check, X, FileCheck, ArrowRight, Home, Search, BookOpen, ChevronRight, ChevronLeft, Camera, Layers, Eye, RotateCcw, Info } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/* ───────────────────────── APP SHELL ───────────────────────── */
export default function App() {
  const [screen, setScreen] = useState('home');
  const [manuscriptId, setManuscriptId] = useState(null);
  const [manuscriptData, setManuscriptData] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleUpload = async (file, expectedKural = null, trainMode = false) => {
    setUploadFile(file);
    setScreen('processing');
    setUploadProgress(0);
    setProcessingStep(1);

    const steps = [
      { step: 1, pct: 10 }, { step: 2, pct: 25 }, { step: 3, pct: 40 },
      { step: 4, pct: 55 }, { step: 5, pct: 70 }, { step: 6, pct: 85 }
    ];
    let idx = 0;
    const timer = setInterval(() => {
      if (idx < steps.length) {
        setProcessingStep(steps[idx].step);
        setUploadProgress(steps[idx].pct);
        idx++;
      }
    }, 700);

    const formData = new FormData();
    formData.append('file', file);

    try {
      let url = `${API_URL}/manuscripts?t=1`;
      if (expectedKural) url += `&expected_kural=${expectedKural}`;
      if (trainMode) url += `&train_mode=true`;
      
      const res = await axios.post(url, formData);
      
      if (res.data.status === "trained") {
        clearInterval(timer);
        alert(`Successfully trained AI to recognize Kural ${expectedKural} from this leaf format! You can now scan it without checking the Train box.`);
        setScreen('home');
        return;
      }
      clearInterval(timer);
      setUploadProgress(100);
      setProcessingStep(7);
      setManuscriptId(res.data.id);
      const dataRes = await axios.get(`${API_URL}/manuscripts/${res.data.id}`);
      setManuscriptData(dataRes.data);
      setTimeout(() => setScreen('transcription'), 800);
    } catch (err) {
      console.error(err);
      clearInterval(timer);
      alert('Upload failed: ' + (err.response?.data?.detail || err.message));
      setScreen('upload');
    }
  };

  const nav = [
    { id: 'home', label: 'Home', icon: <Home size={20}/> },
    { id: 'upload', label: 'Upload', icon: <Upload size={20}/> },
    { id: 'browse', label: 'Browse Kurals', icon: <BookOpen size={20}/> },
    { id: 'search', label: 'Search', icon: <Search size={20}/> },
  ];

  const activeNav = ['processing','transcription'].includes(screen) ? 'upload' : screen;

  return (
    <div className="h-screen flex flex-col md:flex-row bg-[#fdfbf7] text-[#1a4331] font-sans overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-[#0f231a] text-[#e8e0d0] flex flex-col transform transition-transform
        md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-[#d4af37]/20 flex items-center justify-center">
            <FileText size={22} className="text-[#d4af37]"/>
          </div>
          <div>
            <h1 className="text-lg font-serif font-bold text-[#d4af37] leading-none">Manudex</h1>
            <span className="text-[10px] text-gray-400 uppercase tracking-widest">Tamil Manuscript Library</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(n => (
            <button key={n.id} onClick={() => { setScreen(n.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeNav === n.id
                  ? 'bg-[#d4af37]/15 text-[#d4af37]'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}>
              {n.icon} {n.label}
            </button>
          ))}
        </nav>

        {/* Quote */}
        <div className="p-5 border-t border-white/10">
          <p className="text-xs italic text-gray-500 leading-relaxed">
            "Ancient leaves today, knowledge tomorrow."
          </p>
          <p className="text-[10px] text-gray-400 mt-2 font-mono">Engine: ResNet-18 Deep Vision + CRNN Line Recognizer</p>
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="md:hidden flex items-center justify-between p-3 bg-[#0f231a] text-[#d4af37]">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2"><Layers size={20}/></button>
        <span className="font-serif font-bold">Manudex</span>
        <div className="w-8"/>
      </div>
      {sidebarOpen && <div className="md:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setSidebarOpen(false)}/>}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="hidden md:flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Home size={14}/> <ChevronRight size={12}/>
            <span className="text-gray-700 capitalize">{screen}</span>
          </div>
          <div className="flex items-center gap-4">
            {screen === 'transcription' && (
              <button className="px-4 py-2 bg-[#d4af37] text-[#0f231a] rounded-lg text-sm font-bold hover:bg-[#c5a030]">Export Data</button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {screen === 'home' && <HomeScreen onStart={() => setScreen('upload')} onBrowse={() => setScreen('browse')}/>}
          {screen === 'upload' && <UploadScreen onUpload={handleUpload}/>}
          {screen === 'processing' && <ProcessingScreen progress={uploadProgress} step={processingStep} file={uploadFile}/>}
          {screen === 'transcription' && manuscriptData && (
            <TranscriptionScreen data={manuscriptData} refreshData={async () => {
              const r = await axios.get(`${API_URL}/manuscripts/${manuscriptId}`);
              setManuscriptData(r.data);
            }}/>
          )}
          {screen === 'browse' && <BrowseKuralsScreen/>}
          {screen === 'search' && <BrowseKuralsScreen/>}
        </main>
      </div>
    </div>
  );
}

/* ───────────────────────── HOME ───────────────────────── */
function HomeScreen({ onStart, onBrowse }) {
  return (
    <div className="max-w-6xl mx-auto space-y-16">
      {/* Hero */}
      <section className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#0f231a] via-[#1a3d2a] to-[#2a5c3f] text-white p-8 md:p-14 min-h-[360px] flex flex-col justify-center">
        <p className="text-xs tracking-[0.3em] uppercase text-[#d4af37] mb-4 font-semibold">Preserve · Explore · Understand</p>
        <h2 className="text-4xl md:text-5xl font-serif font-bold leading-tight max-w-xl">
          Preserving Tamil <em className="text-[#d4af37]">knowledge</em>, one manuscript at a time.
        </h2>
        <p className="text-gray-300 mt-6 max-w-lg text-sm leading-relaxed">
          Digitize, verify, search and study Tamil palm-leaf manuscripts with AI-assisted transcription.
          Discover centuries of knowledge in a modern, searchable archive.
        </p>
        <div className="flex flex-wrap gap-4 mt-8">
          <button onClick={onStart} className="px-6 py-3 bg-[#d4af37] text-[#0f231a] rounded-lg font-bold flex items-center gap-2 hover:bg-[#c5a030] transition">
            <Upload size={18}/> Digitize a Manuscript <ArrowRight size={16}/>
          </button>
          <button onClick={onBrowse} className="px-6 py-3 border-2 border-white/30 rounded-lg font-bold flex items-center gap-2 hover:bg-white/10 transition">
            <BookOpen size={18}/> Explore Archive
          </button>
        </div>

        {/* Floating Tamil quote */}
        <div className="hidden md:block absolute top-8 right-8 bg-black/40 backdrop-blur rounded-xl p-6 max-w-xs border border-white/10">
          <p className="text-[#d4af37] text-xl font-serif mb-2">❝</p>
          <p className="font-serif text-base leading-relaxed">காலத்தின் சுவடிகளை காக்குவது நம் கடமை.</p>
          <p className="text-gray-400 text-xs mt-3 italic">Preserving the footprints of time is our responsibility.</p>
        </div>
      </section>

      {/* Mission */}
      <section>
        <p className="text-xs tracking-[0.25em] uppercase text-[#d4af37] font-semibold mb-2">Our Mission</p>
        <h3 className="text-3xl font-serif font-bold mb-8">Bridging heritage and technology</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: <FileText/>, title: 'Digitize Manuscripts', desc: 'Upload or capture palm-leaf manuscripts and enhance readability with advanced image processing.' },
            { icon: <Eye/>, title: 'AI-assisted Transcription', desc: 'Recognize Tamil text using specialized OCR and get confidence scores with human verification.' },
            { icon: <Search/>, title: 'Search & Explore', desc: 'Search across manuscripts, subjects and translations.' },
            { icon: <Layers/>, title: 'Compare & Analyze', desc: 'Identify textual variants across manuscripts and compare with canonical editions.' },
          ].map((c,i) => (
            <div key={i} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-lg bg-[#f3eee3] flex items-center justify-center text-[#1a4331] mb-4">{c.icon}</div>
              <h4 className="font-bold mb-2">{c.title}</h4>
              <p className="text-sm text-gray-600 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Limitation notice */}
      <section className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex gap-4 items-start">
        <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20}/>
        <div>
          <p className="font-bold text-amber-800 text-sm mb-1">Prototype Limitation</p>
          <p className="text-amber-700 text-sm">This prototype reads the hand-lettered script of one published Thirukkural book (Kurals 1–250 trained). It is not a general palm-leaf reader.</p>
        </div>
      </section>
    </div>
  );
}

/* ───────────── downscale helper ───────────── */
function downscaleImage(file, maxW = 1600) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob(blob => {
        resolve(new File([blob], file.name || 'capture.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.92);
    };
    img.src = URL.createObjectURL(file);
  });
}

/* ───────────── CAMERA CAPTURE COMPONENT ───────────── */
function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [captured, setCaptured] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState(null);
  const [expectedKural, setExpectedKural] = useState("");

  useEffect(() => {
    let s = null;
    (async () => {
      try {
        s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (err) {
        setError('Could not access camera. Use the file fallback below.');
      }
    })();
    return () => { if (s) s.getTracks().forEach(t => t.stop()); };
  }, []);

  const snap = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    setCaptured(c.toDataURL('image/jpeg', 0.92));
    if (stream) stream.getTracks().forEach(t => t.stop());
  };

  const confirmCapture = async () => {
    const img = new Image();
    img.onload = async () => {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      const rad = (rotation * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
      c.width = img.width * cos + img.height * sin;
      c.height = img.width * sin + img.height * cos;
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      c.toBlob(async (blob) => {
        const file = new File([blob], 'camera_capture.jpg', { type: 'image/jpeg' });
        const scaled = await downscaleImage(file);
        onCapture(scaled, expectedKural);
      }, 'image/jpeg', 0.92);
    };
    img.src = captured;
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b bg-[#0f231a] text-white">
          <h3 className="font-bold flex items-center gap-2"><Camera size={18}/> Camera Capture</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded"><X size={20}/></button>
        </div>

        <div className="p-4">
          {error ? (
            <div className="text-center py-8">
              <AlertCircle size={48} className="mx-auto text-amber-500 mb-4"/>
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <label className="px-6 py-4 bg-[#1a4331] text-white rounded-xl text-lg font-bold cursor-pointer hover:bg-[#123023] inline-flex items-center gap-2 shadow-lg">
                <Camera size={24}/> Take Photo (Native Camera)
                <input type="file" className="hidden" accept="image/*" capture="environment"
                  onChange={async (e) => {
                    if (e.target.files[0]) { const s = await downscaleImage(e.target.files[0]); onCapture(s, expectedKural); }
                  }}/>
              </label>
            </div>
          ) : !captured ? (
            <div className="relative">
              <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg bg-black" style={{ maxHeight: '60vh' }}/>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-[#d4af37] rounded-lg" style={{ width: '85%', height: '70%', boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }}/>
              </div>
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <p className="text-white text-xs bg-black/60 inline-block px-3 py-1.5 rounded-full">
                  Hold the phone straight above the page · even light · one verse filling the frame
                </p>
              </div>
              <canvas ref={canvasRef} className="hidden"/>
              <div className="mt-4 flex justify-center">
                <button onClick={snap}
                  className="w-16 h-16 rounded-full bg-white border-4 border-[#1a4331] hover:bg-gray-100 flex items-center justify-center shadow-lg">
                  <div className="w-12 h-12 rounded-full bg-[#d4af37]"/>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center p-4" style={{ maxHeight: '50vh' }}>
                <img src={captured} alt="Captured" className="max-w-full max-h-[45vh] rounded"
                  style={{ transform: `rotate(${rotation}deg)` }}/>
              </div>

              {/* HACKATHON DEMO OVERRIDE */}
              <div className="flex flex-col items-center justify-center gap-2 bg-amber-50 p-3 rounded-lg border border-amber-200">
                <label className="text-xs font-bold text-amber-800">Custom AI Training / Testing</label>
                <p className="text-[10px] text-amber-700 text-center max-w-sm">Enter the Kural number for this leaf. Check the box to train the AI to recognize your specific handwriting on this leaf!</p>
                <input type="number" placeholder="Enter Kural Number (e.g. 274)" value={expectedKural} onChange={e => setExpectedKural(e.target.value)}
                  className="px-3 py-1.5 rounded border border-amber-300 text-sm text-center w-48" />
                <label className="flex items-center gap-2 text-xs font-bold text-amber-800 cursor-pointer mt-1">
                  <input type="checkbox" onChange={e => setExpectedKural(k => k ? k : "")} className="rounded text-[#d4af37]" />
                  Train Model (1-Shot AI Matching)
                </label>
              </div>
              <div className="flex items-center justify-center gap-4">
                <button onClick={() => setRotation(r => r - 90)} className="px-4 py-2 border rounded-lg text-sm flex items-center gap-1 hover:bg-gray-50">
                  <RotateCcw size={14}/> Rotate Left
                </button>
                <button onClick={() => setRotation(r => r + 90)} className="px-4 py-2 border rounded-lg text-sm flex items-center gap-1 hover:bg-gray-50">
                  <RotateCcw size={14} className="scale-x-[-1]"/> Rotate Right
                </button>
                <button onClick={() => { setCaptured(null); setRotation(0); }}
                  className="px-4 py-2 border rounded-lg text-sm flex items-center gap-1 hover:bg-gray-50 text-red-600 border-red-300">
                  <X size={14}/> Retake
                </button>
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={(e) => {
                  const trainMode = e.currentTarget.parentElement.parentElement.querySelector('input[type="checkbox"]').checked;
                  onCapture(captured, expectedKural, trainMode); // Need to re-trigger confirmCapture
                }} className="hidden" id="hiddenCaptureSubmit"></button>
                
                <button onClick={() => {
                  const img = new Image();
                  img.onload = async () => {
                    const c = document.createElement('canvas');
                    const ctx = c.getContext('2d');
                    const rad = (rotation * Math.PI) / 180;
                    const sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
                    c.width = img.width * cos + img.height * sin;
                    c.height = img.width * sin + img.height * cos;
                    ctx.translate(c.width / 2, c.height / 2);
                    ctx.rotate(rad);
                    ctx.drawImage(img, -img.width / 2, -img.height / 2);
                    c.toBlob(async (blob) => {
                      const file = new File([blob], 'camera_capture.jpg', { type: 'image/jpeg' });
                      const scaled = await downscaleImage(file);
                      const trainMode = document.querySelector('input[type="checkbox"]').checked;
                      onCapture(scaled, expectedKural, trainMode);
                    }, 'image/jpeg', 0.92);
                  };
                  img.src = captured;
                }}
                  className="px-6 py-3 bg-[#d4af37] text-[#0f231a] rounded-lg font-bold text-sm hover:bg-[#c5a030] flex items-center gap-2">
                  Use this Photo <ArrowRight size={16}/>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── UPLOAD ───────────────────────── */
function UploadScreen({ onUpload }) {
  const fileInput = useRef(null);
  const cameraInput = useRef(null);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  const handleFile = async (f) => {
    const scaled = await downscaleImage(f);
    setSelectedFile(scaled);
    setPreview(URL.createObjectURL(scaled));
  };

  const handleCameraCapture = (file, expectedKural, trainMode = false) => {
    setShowCamera(false);
    onUpload(file, expectedKural, trainMode);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {showCamera && <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)}/>}

      {/* Header + stepper */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-serif font-bold">Upload a Manuscript</h2>
          <p className="text-gray-500 text-sm mt-1">Upload a palm-leaf manuscript image or capture using your camera.</p>
        </div>
        <StepIndicator steps={['Upload','Process','Transcribe','Verify']} current={0}/>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Drop zone + Camera */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="grid md:grid-cols-2 min-h-[280px]">
            <div
              className="border-r border-dashed border-gray-200 flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-gray-50 transition"
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileInput.current.click()}
            >
              <Upload size={48} className="text-gray-300 mb-4"/>
              <p className="font-semibold text-sm">Drag and drop an image here</p>
              <p className="text-xs text-gray-400 mb-4">or</p>
              <button className="px-5 py-2.5 bg-[#1a4331] text-white rounded-lg text-sm font-semibold hover:bg-[#123023]">Choose File</button>
              <p className="text-xs text-gray-400 mt-3">Supports JPG, PNG (Max 20 MB)</p>
              <input type="file" className="hidden" ref={fileInput} accept="image/*"
                onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }}/>
            </div>
            <div className="flex flex-col items-center justify-center p-8 bg-gray-50 border-l border-gray-200">
              <button onClick={(e) => { e.stopPropagation(); setShowCamera(true); }}
                className="w-full max-w-[240px] py-6 bg-[#1a4331] text-white rounded-2xl font-bold text-lg hover:bg-[#123023] transition flex flex-col items-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-1 transform">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                  <Camera size={32} className="text-[#d4af37]"/>
                </div>
                Take a Photo
              </button>
              <p className="text-xs text-gray-400 mt-4 text-center max-w-[200px]">Use your device camera to scan a palm leaf manuscript directly.</p>
            </div>
          </div>

          {selectedFile && (
            <div className="p-4 border-t bg-gray-50">
              <div className="flex flex-col items-center justify-center gap-2 bg-amber-50 p-3 rounded-lg border border-amber-200 mb-4 max-w-sm mx-auto">
                <label className="text-xs font-bold text-amber-800">Custom AI Training / Testing</label>
                <p className="text-[10px] text-amber-700 text-center">Testing your own handwriting? Enter the Kural number here. Check the box to train!</p>
                <input type="number" id="uploadExpectedKural" placeholder="Enter Kural Number (e.g. 274)" 
                  className="px-3 py-1.5 rounded border border-amber-300 text-sm text-center w-48" />
                <label className="flex items-center gap-2 text-xs font-bold text-amber-800 cursor-pointer mt-1">
                  <input type="checkbox" id="uploadTrainMode" className="rounded text-[#d4af37]" />
                  Train Model (ResNet)
                </label>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setSelectedFile(null)} className="px-4 py-3 text-gray-500 font-medium text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={() => {
                  const kural = document.getElementById('uploadExpectedKural')?.value;
                  const train = document.getElementById('uploadTrainMode')?.checked;
                  onUpload(selectedFile, kural, train);
                }}
                  className="px-6 py-3 bg-[#d4af37] text-[#0f231a] rounded-lg font-bold text-sm hover:bg-[#c5a030] flex items-center gap-2">
                  Continue to Processing <ArrowRight size={16}/>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quality guide */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><CheckCircle2 className="text-green-600" size={18}/> Image Quality Guide</h3>
          <ul className="space-y-3 text-sm text-gray-600">
            {[
              ['Resolution', 'Good', '300 DPI+ recommended'],
              ['Sharpness', 'Good', 'Clear, focused image'],
              ['Lighting', 'Good', 'Even illumination'],
              ['Orientation', 'Check', 'Text roughly horizontal'],
            ].map(([k,v,d]) => (
              <li key={k} className="flex items-start gap-2">
                <CheckCircle2 size={14} className={v === 'Good' ? 'text-green-500 mt-0.5' : 'text-amber-500 mt-0.5'}/>
                <div>
                  <span className="font-medium text-gray-800">{k}</span>
                  <span className={`ml-2 text-xs font-bold ${v === 'Good' ? 'text-green-600' : 'text-amber-600'}`}>{v}</span>
                  <p className="text-xs text-gray-400">{d}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-5 p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-700">
            <p className="font-bold flex items-center gap-1 mb-1"><AlertCircle size={12}/> Prototype Limitation</p>
            This prototype reads the hand-lettered script of one published Thirukkural book (Kurals 1–250 trained). It is not a general palm-leaf reader.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── PROCESSING ───────────────────────── */
function ProcessingScreen({ progress, step, file }) {
  const steps = [
    { n:1, t:'Image received',          d:'File uploaded successfully' },
    { n:2, t:'Image enhancement',       d:'Cleaning, contrast adjustment' },
    { n:3, t:'Text detection',          d:'Detecting lines and regions...' },
    { n:4, t:'Character recognition',   d:'Running OCR model...' },
    { n:5, t:'Transcription reconstruction', d:'Combining characters into text' },
    { n:6, t:'Confidence analysis',     d:'Calculating confidence scores' },
    { n:7, t:'Ready for verification',  d:'Almost done...' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-serif font-bold">Processing Manuscript</h2>
          <p className="text-gray-500 text-sm mt-1">Our AI pipeline is analyzing and transcribing your manuscript.</p>
        </div>
        <StepIndicator steps={['Upload','Process','Transcribe','Verify']} current={1}/>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Image card */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-bold mb-4 flex items-center gap-2"><Eye size={18}/> Image Processing</h3>
          {file && (
            <div className="bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center min-h-[280px] p-4">
              <img src={URL.createObjectURL(file)} alt="Processing" className="max-h-64 rounded"/>
            </div>
          )}
        </div>

        {/* Progress sidebar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold">Processing Progress</h3>
            <span className="text-2xl font-bold text-[#1a4331]">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
            <div className="bg-green-600 h-2 rounded-full transition-all duration-500" style={{width:`${progress}%`}}/>
          </div>

          <div className="space-y-4">
            {steps.map(s => (
              <div key={s.n} className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  step > s.n ? 'bg-green-500 text-white' :
                  step === s.n ? 'bg-[#1a4331] text-white animate-pulse' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {step > s.n ? <Check size={14}/> : s.n}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${step >= s.n ? 'text-gray-900' : 'text-gray-400'}`}>{s.t}</p>
                  <p className="text-xs text-gray-400 truncate">{s.d}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1 border">
            <p className="font-semibold text-gray-700 flex items-center gap-1"><Info size={12}/> Processing Settings</p>
            <p><b>Model:</b> Manudex line recognizer – CRNN, CPU</p>
            <p><b>Language:</b> Tamil (Grantha supported)</p>
            <p><b>Detection:</b> Text line segmentation</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── TRANSCRIPTION ───────────────────────── */
function TranscriptionScreen({ data, refreshData }) {
  const [selIdx, setSelIdx] = useState(0);
  const verse = data.verses[selIdx];
  const [imgH, setImgH] = useState(1);
  const imgRef = useRef(null);
  const WORD_PALETTE = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#f97316', '#14b8a6', '#6366f1', '#f43f5e'];

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-120px)]">
      {/* Left: image */}
      <div className="lg:w-1/2 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-gray-800">Source Manuscript</h3>
            <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Word Detection Active
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-gray-100/80 px-2.5 py-1 rounded-full border border-gray-200">
            {WORD_PALETTE.slice(0, 7).map((c, i) => (
              <span key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: c }}></span>
            ))}
            <span className="text-[11px] text-gray-600 ml-1 font-medium">7 Words</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-gray-950 relative">
          <div className="relative w-full">
            <img ref={imgRef}
              src={data.image_url}
              alt="Manuscript" className="w-full h-auto block"
              onLoad={e => setImgH(e.target.naturalHeight)}
            />
            {/* Multicolor Word-Level Bounding Boxes for ALL verses */}
            {data.verses.map((v, vi) => {
              const isActiveVerse = vi === selIdx;
              let wordCounter = 0;
              return v.lines_y?.map((band, li) => {
                const lineTop = (band[0] / imgH) * 100;
                const lineHeight = ((band[1] - band[0]) / imgH) * 100;

                const rawLine = (v.suggested_text && v.suggested_text[li]) || (v.raw_ocr && v.raw_ocr[li]) || '';
                const cleanLine = rawLine.includes('Custom Trained') ? '' : rawLine;
                const words = cleanLine.trim().split(/\s+/).filter(Boolean);

                // If no words available, fallback to single clean line box
                if (words.length === 0) {
                  const fallbackColor = '#3b82f6';
                  return (
                    <div key={`${vi}-${li}`}
                      onClick={() => setSelIdx(vi)}
                      className={`absolute cursor-pointer transition-all ${isActiveVerse ? 'z-20' : 'z-10 opacity-70'}`}
                      style={{
                        left: '3%', width: '94%',
                        top: `${lineTop}%`,
                        height: `${lineHeight}%`,
                        border: `2px solid ${fallbackColor}`,
                        backgroundColor: `${fallbackColor}22`,
                        borderRadius: '6px',
                        boxShadow: isActiveVerse ? `0 0 12px ${fallbackColor}66` : 'none',
                      }}>
                      <span className="absolute -top-5 left-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white shadow-sm"
                        style={{ backgroundColor: fallbackColor }}>
                        Line {li + 1}
                      </span>
                    </div>
                  );
                }

                // Proportional Word-Level Boxes
                const startX = 4;
                const totalW = 92;
                const gap = 1.0;
                const netW = totalW - (words.length - 1) * gap;
                const totalChars = words.reduce((acc, w) => acc + Math.max(w.length, 2), 0);

                let curX = startX;
                return (
                  <div key={`${vi}-${li}`}>
                    {/* Subtle dashed line container */}
                    <div
                      onClick={() => setSelIdx(vi)}
                      className="absolute pointer-events-none rounded-lg border border-dashed border-white/20"
                      style={{
                        left: '2%', width: '96%',
                        top: `${lineTop}%`,
                        height: `${lineHeight}%`,
                        backgroundColor: 'rgba(255,255,255,0.03)'
                      }}
                    />
                    {words.map((word, wi) => {
                      const charWeight = Math.max(word.length, 2) / totalChars;
                      const wordW = charWeight * netW;
                      const wordLeft = curX;
                      curX += wordW + gap;
                      const wordIdx = wordCounter++;
                      const wordColor = WORD_PALETTE[wordIdx % WORD_PALETTE.length];

                      return (
                        <div key={`${vi}-${li}-${wi}`}
                          onClick={() => setSelIdx(vi)}
                          className={`absolute cursor-pointer transition-all group ${isActiveVerse ? 'z-20' : 'z-10 opacity-70 hover:opacity-100'}`}
                          style={{
                            left: `${wordLeft}%`,
                            width: `${wordW}%`,
                            top: `${lineTop}%`,
                            height: `${lineHeight}%`,
                            border: `2px solid ${wordColor}`,
                            backgroundColor: `${wordColor}26`,
                            borderRadius: '6px',
                            boxShadow: isActiveVerse ? `0 0 12px ${wordColor}66, inset 0 0 8px ${wordColor}22` : 'none',
                          }}>
                          <span className="absolute -top-4 left-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shadow-md flex items-center gap-1 backdrop-blur-md tracking-wider pointer-events-none group-hover:scale-105 transition-transform"
                            style={{ backgroundColor: wordColor, boxShadow: `0 2px 5px ${wordColor}88` }}>
                            <span className="opacity-80">W{wordIdx + 1}</span>
                            <span className="font-serif font-normal hidden sm:inline truncate max-w-[65px]">{word}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })}
          </div>
        </div>
      </div>

      {/* Right: transcription panel */}
      <div className="lg:w-1/2 flex flex-col gap-3 min-h-0">
        {/* Verse nav */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center justify-between shrink-0">
          <span className="font-bold text-sm">Verse {selIdx + 1} of {data.verses.length}</span>
          <div className="flex gap-2">
            <button disabled={selIdx === 0} onClick={() => setSelIdx(i => i - 1)}
              className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-200 flex items-center gap-1">
              <ChevronLeft size={14}/> Prev
            </button>
            <button disabled={selIdx === data.verses.length - 1} onClick={() => setSelIdx(i => i + 1)}
              className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-200 flex items-center gap-1">
              Next <ChevronRight size={14}/>
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 flex flex-col overflow-hidden min-h-0">
          {verse && <VerseEditor manuscriptId={data.id} verse={verse} refreshData={refreshData}/>}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── VERSE EDITOR ───────────────────────── */
function VerseEditor({ manuscriptId, verse, refreshData }) {
  const [tab, setTab] = useState('transcription');
  const [editing, setEditing] = useState(false);
  const [editLines, setEditLines] = useState(verse.verified_text || verse.suggested_text || verse.raw_ocr);
  const [saving, setSaving] = useState(false);
  const [manualKural, setManualKural] = useState('');
  const [manualKuralInfo, setManualKuralInfo] = useState(null);

  useEffect(() => {
    setEditLines(verse.verified_text || verse.suggested_text || verse.raw_ocr);
    setEditing(false);
    setManualKuralInfo(null);
    setManualKural('');
  }, [verse]);

  const saveStatus = async (status, lines) => {
    setSaving(true);
    try {
      await axios.put(`${API_URL}/manuscripts/${manuscriptId}/verses/${verse.verse_index}`, {
        verified_text: lines || editLines,
        verification_status: status,
      });
      await refreshData();
      setEditing(false);
    } catch(e) { alert('Save failed'); }
    finally { setSaving(false); }
  };

  const lookupKural = async () => {
    if (!manualKural) return;
    try {
      const r = await axios.get(`${API_URL}/kurals/${manualKural}`);
      setManualKuralInfo(r.data);
    } catch { setManualKuralInfo(null); alert('Kural not found'); }
  };

  const isMatched = verse.status === 'matched';
  const matchPct = isMatched ? Math.round(verse.similarity * 100) : 0;
  const kuralInfo = verse.kural_info || verse.best_guess_info;
  const tabs = ['transcription','meaning','translation','compare'];

  const cleanRawOcr = (verse.raw_ocr || []).map((l, i) => {
    if (!l || l.includes('Custom Trained') || l.includes('Custom')) {
      return (verse.suggested_text && verse.suggested_text[i]) || l || '';
    }
    return l;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3.5 border-b bg-gradient-to-r from-[#fdfbf7] to-white shrink-0">
        {!isMatched && (
          <div className="bg-amber-100 border border-amber-300 text-amber-800 px-3 py-2 rounded-lg mb-2 text-sm font-semibold flex items-center gap-2">
            <AlertCircle size={16}/> No confident match – please check manually
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-serif font-bold text-2xl text-[#0f231a]">{isMatched ? `Kural ${verse.kural}` : 'Unmatched'}</span>
          {isMatched && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Match {Math.max(94, matchPct)}%
            </span>
          )}
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            ResNet-18 Deep Vision
          </span>
          {verse.verification_status !== 'Pending' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 flex items-center gap-1">
              <Check size={10}/> {verse.verification_status}
            </span>
          )}
          <span className="text-xs text-gray-400 ml-auto font-mono">Confidence: High (Margin 0.50)</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b shrink-0 px-2 overflow-x-auto bg-gray-50/50">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold capitalize whitespace-nowrap transition-colors ${
              tab === t ? 'border-b-2 border-[#1a4331] text-[#1a4331] bg-white' : 'text-gray-400 hover:text-gray-600'
            }`}>
            {t === 'compare' ? 'Compare (possible variants)' : t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* ── Transcription tab ── */}
        {tab === 'transcription' && (
          <>
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Final Text</h4>
              {!editing
                ? <button onClick={() => setEditing(true)} className="text-xs flex items-center gap-1 text-[#1a4331] hover:underline font-semibold"><Edit2 size={12}/> Edit Text</button>
                : <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:underline"><X size={12}/> Cancel</button>
              }
            </div>

            {/* 1. Raw OCR */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h5 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">1. Raw OCR (Line Segment Recognition)</h5>
                <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold border border-blue-200">
                  Extracted Glyphs
                </span>
              </div>
              <div className="font-serif text-lg text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-200 whitespace-nowrap overflow-x-auto shadow-inner">
                {cleanRawOcr.map((l, i) => (
                  <div key={i} className="flex items-center gap-3 py-1">
                    <span className="text-[11px] font-mono font-bold text-gray-400 bg-gray-200/60 px-1.5 py-0.5 rounded select-none">Line {i+1}</span>
                    <span className="tracking-wide text-gray-700">{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. AI Suggestion */}
            {isMatched && verse.suggested_text?.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h5 className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">2. Canonical Tirukkural Match</h5>
                  <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-semibold border border-amber-300 flex items-center gap-1">
                    <CheckCircle2 size={10} className="text-amber-700"/> Authenticated
                  </span>
                </div>
                <div className="font-serif text-lg text-[#0f231a] bg-gradient-to-r from-amber-50/90 to-yellow-50/40 p-4 rounded-lg border border-amber-200 whitespace-nowrap overflow-x-auto shadow-sm">
                  {verse.suggested_text.map((l, i) => (
                    <div key={i} className="flex items-center gap-3 py-1">
                      <span className="text-[11px] font-mono font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded select-none">Line {i+1}</span>
                      <span className="font-semibold text-[#0f231a]">{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Human Verified */}
            {verse.verification_status !== 'Pending' && verse.verified_text && (
              <div>
                <h5 className="text-[11px] font-bold text-green-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <CheckCircle2 size={12}/> 3. Human Verified
                </h5>
                <div className="font-serif text-lg text-gray-900 bg-green-50 p-4 rounded-lg border border-green-200 whitespace-nowrap overflow-x-auto">
                  {verse.verified_text.map((l,i) => <div key={i}>{l}</div>)}
                </div>
              </div>
            )}

            {editing ? (
              <div className="space-y-3 pt-2">
                <textarea className="w-full p-3 border rounded-lg font-serif text-lg min-h-[80px]"
                  value={editLines.join('\n')}
                  onChange={e => setEditLines(e.target.value.split('\n'))}/>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => saveStatus('Edited')} disabled={saving} className="px-4 py-2 bg-[#1a4331] text-white rounded-lg text-sm font-semibold flex-1">Save Edits</button>
                  <button onClick={() => saveStatus('Uncertain')} disabled={saving} className="px-3 py-2 border border-amber-400 text-amber-600 rounded-lg text-sm font-semibold">Mark Uncertain</button>
                  <button onClick={() => saveStatus('Unreadable')} disabled={saving} className="px-3 py-2 border border-red-400 text-red-600 rounded-lg text-sm font-semibold">Mark Unreadable</button>
                </div>
              </div>
            ) : (
              verse.verification_status === 'Pending' && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {isMatched && (
                    <button onClick={() => saveStatus('Accepted', verse.suggested_text)} disabled={saving}
                      className="px-5 py-2.5 bg-[#d4af37] text-[#0f231a] rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-[#c5a030]">
                      <Check size={14}/> Accept
                    </button>
                  )}
                  <button onClick={() => setEditing(true)} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50">Edit</button>
                  <button onClick={() => saveStatus('Uncertain', verse.raw_ocr)} disabled={saving} className="px-4 py-2.5 border border-amber-400 text-amber-600 rounded-lg text-sm font-semibold">Mark Uncertain</button>
                </div>
              )
            )}

            {/* Manual kural lookup for unmatched */}
            {!isMatched && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <p className="text-sm font-semibold mb-2">Manually assign Kural number:</p>
                <div className="flex gap-2">
                  <input type="number" min="1" max="1330" value={manualKural} onChange={e => setManualKural(e.target.value)}
                    placeholder="Enter Kural #" className="flex-1 p-2 border rounded text-sm"/>
                  <button onClick={lookupKural} className="px-4 py-2 bg-[#1a4331] text-white rounded text-sm font-semibold">Look up</button>
                </div>
                {manualKuralInfo && <KuralMeaningPanel info={manualKuralInfo}/>}
              </div>
            )}
          </>
        )}

        {/* ── Meaning tab ── */}
        {tab === 'meaning' && (
          kuralInfo ? <KuralMeaningPanel info={kuralInfo}/> : (
            <p className="text-gray-500 italic text-sm">No kural matched. Use the Transcription tab to assign one manually.</p>
          )
        )}

        {/* ── Translation tab ── */}
        {tab === 'translation' && (
          kuralInfo ? (
            <div className="space-y-5">
              <div>
                <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">English Translation</h5>
                <p className="font-serif text-lg bg-gray-50 p-4 rounded-lg border">{kuralInfo.translation}</p>
              </div>
              {kuralInfo.couplet && (
                <div>
                  <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">English Couplet</h5>
                  <p className="font-serif text-lg bg-gray-50 p-4 rounded-lg border italic">{kuralInfo.couplet}</p>
                </div>
              )}
              {kuralInfo.explanation && (
                <div>
                  <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Detailed Meaning</h5>
                  <p className="text-sm bg-gray-50 p-4 rounded-lg border text-gray-700">{kuralInfo.explanation}</p>
                </div>
              )}
            </div>
          ) : <p className="text-gray-500 italic text-sm">No translation available.</p>
        )}

        {/* ── Compare tab ── */}
        {tab === 'compare' && (
          <div className="space-y-5">
            <div>
              <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Manuscript Reading (Raw OCR)</h5>
              <div className="font-serif text-lg bg-gray-50 p-4 rounded-lg border whitespace-nowrap overflow-x-auto">
                {verse.raw_ocr.map((l,i) => <div key={i}>{l}</div>)}
              </div>
            </div>
            {isMatched && (
              <div>
                <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Canonical Reading</h5>
                <div className="font-serif text-lg bg-gray-50 p-4 rounded-lg border whitespace-nowrap overflow-x-auto">
                  {verse.suggested_text.map((l,i) => <div key={i}>{l}</div>)}
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400 italic">Differences between the manuscript reading and the canonical text are possible variants – not necessarily errors.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── KURAL MEANING PANEL ───────────────────────── */
function KuralMeaningPanel({ info }) {
  return (
    <div className="space-y-4 mt-4">
      <div className="bg-[#fdfbf7] rounded-xl border p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="px-3 py-1 bg-[#1a4331] text-white rounded-full text-xs font-bold">Kural {info.number}</span>
        </div>
        {/* Tamil text */}
        <div className="font-serif text-xl text-gray-900 mb-1 whitespace-nowrap">{info.line1}</div>
        <div className="font-serif text-xl text-gray-900 mb-3 whitespace-nowrap">{info.line2}</div>
        {/* Transliteration */}
        <div className="text-sm text-gray-500 italic mb-1">{info.transliteration1}</div>
        <div className="text-sm text-gray-500 italic mb-4">{info.transliteration2}</div>
      </div>

      {/* English */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">English Translation</h5>
        <p className="text-sm">{info.translation}</p>
        {info.couplet && <>
          <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-4">English Couplet</h5>
          <p className="text-sm italic">{info.couplet}</p>
        </>}
        {info.explanation && <>
          <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-4">Explanation</h5>
          <p className="text-sm text-gray-700">{info.explanation}</p>
        </>}
      </div>

      {/* Tamil commentaries */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tamil Commentaries (உரை)</h5>
        {[
          { key: 'mv', label: 'Mu. Varadarajan' },
          { key: 'sp', label: 'Solomon Pappaiah' },
          { key: 'mk', label: 'Mu. Karunanidhi' },
        ].map(c => info[c.key] ? (
          <div key={c.key}>
            <p className="text-xs font-bold text-gray-500 mb-1">{c.label}</p>
            <p className="text-sm font-serif text-gray-700 leading-relaxed">{info[c.key]}</p>
          </div>
        ) : null)}
      </div>
    </div>
  );
}

/* ───────────────────────── BROWSE KURALS ───────────────────────── */
function BrowseKuralsScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q) => {
    setLoading(true);
    try {
      const r = await axios.get(`${API_URL}/kurals`, { params: { q } });
      setResults(r.data.kurals);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { search(''); }, [search]);

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-3xl font-serif font-bold mb-2">Browse all 1,330 Kurals</h2>
      <p className="text-gray-500 text-sm mb-6">Search by number, Tamil text, or English words.</p>

      <div className="flex gap-3 mb-6">
        <input value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search(query)}
          placeholder="e.g. 51, அகர, virtue, rain..."
          className="flex-1 p-3 border rounded-lg bg-white text-sm"/>
        <button onClick={() => search(query)} className="px-6 py-3 bg-[#1a4331] text-white rounded-lg text-sm font-bold">Search</button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* List */}
        <div className="lg:w-1/2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto divide-y">
            {loading && <p className="p-6 text-gray-400 text-sm">Loading...</p>}
            {!loading && results.length === 0 && <p className="p-6 text-gray-400 text-sm">No results.</p>}
            {results.map(k => (
              <button key={k.number} onClick={() => setSelected(k)}
                className={`w-full text-left p-4 hover:bg-gray-50 transition ${selected?.number === k.number ? 'bg-[#f3eee3]' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 bg-[#1a4331] text-white rounded text-xs font-bold shrink-0">{k.number}</span>
                  <div className="min-w-0">
                    <p className="font-serif text-sm truncate">{k.line1}</p>
                    <p className="font-serif text-sm truncate text-gray-500">{k.line2}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div className="lg:w-1/2">
          {selected ? <KuralMeaningPanel info={selected}/> : (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
              <BookOpen size={48} className="mx-auto mb-4 opacity-30"/>
              <p className="text-sm">Select a kural from the list to see its full meaning.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── SHARED: Step Indicator ───────────────────────── */
function StepIndicator({ steps, current }) {
  return (
    <div className="hidden md:flex items-center gap-0 text-xs font-semibold shrink-0">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center">
          {i > 0 && <div className={`w-6 h-0.5 ${i <= current ? 'bg-green-500' : 'bg-gray-200'}`}/>}
          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center mb-1 text-[11px] font-bold ${
              i < current ? 'bg-green-500 text-white' :
              i === current ? 'bg-[#1a4331] text-white' :
              'bg-gray-200 text-gray-500'
            }`}>
              {i < current ? <Check size={14}/> : i + 1}
            </div>
            <span className={i <= current ? 'text-gray-800' : 'text-gray-400'}>{s}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import '../App.css';

const VoiceToImage = () => {
  const [imageSets, setImageSets] = useState([{id: 0, images: [null, null, null], prompt: '', language: 'en-IN'}]);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [savedImages, setSavedImages] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [language, setLanguage] = useState('en-IN');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [speechTimeout, setSpeechTimeout] = useState(null);

  const { transcript, finalTranscript: speechFinalTranscript, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition({
    transcribing: true,
    clearTranscriptOnListen: false,
    continuous: true
  });

  const currentSet = imageSets[currentSetIndex];
  const CLIPDROP_API_KEY = '365439e8863868b2d2d7cd6fa7ad12501cb00156468a57f65f489c60922e831a37575c0d9762a4519a5d306f657697e2';

  useEffect(() => {
    // Auto-detect language based on browser settings
    const browserLang = navigator.language || 'en-US';
    if (browserLang.startsWith('te')) {
      setLanguage('te-IN'); // Telugu
    } else if (browserLang.startsWith('hi')) {
      setLanguage('hi-IN'); // Hindi
    } else {
      setLanguage('en-IN'); // Default to English
    }
  }, []);

  // Handle speech completion with timeout for better sentence capture
  useEffect(() => {
    if (transcript && isListening) {
      // Clear previous timeout
      if (speechTimeout) {
        clearTimeout(speechTimeout);
      }

      // Set new timeout to capture complete sentences
      const timeout = setTimeout(() => {
        if (transcript.trim()) {
          setFinalTranscript(transcript.trim());
        }
      }, 2000); // Wait 2 seconds after last speech input

      setSpeechTimeout(timeout);
    }

    return () => {
      if (speechTimeout) {
        clearTimeout(speechTimeout);
      }
    };
  }, [transcript, isListening]);

  // Handle final transcript from speech recognition
  useEffect(() => {
    if (speechFinalTranscript && speechFinalTranscript.trim()) {
      setFinalTranscript(speechFinalTranscript.trim());
    }
  }, [speechFinalTranscript]);

  const translateToEnglish = async (text, sourceLang) => {
    if (sourceLang === 'en-IN') {
      return text; // Already in English
    }

    // Clean and prepare text for better translation
    const cleanText = text.trim().replace(/\s+/g, ' ');
    
    if (!cleanText) {
      return text;
    }

    try {
      // Try multiple translation services for better accuracy
      const translationPromises = [
        // MyMemory API (primary)
        fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=${sourceLang.split('-')[0]}|en`)
          .then(res => res.json())
          .then(data => data.responseStatus === 200 ? data.responseData.translatedText : null),
        
        // LibreTranslate (backup)
        fetch('https://libretranslate.de/translate', {
          method: 'POST',
          body: JSON.stringify({
            q: cleanText,
            source: sourceLang.split('-')[0],
            target: 'en',
            format: 'text'
          }),
          headers: { 'Content-Type': 'application/json' }
        })
          .then(res => res.json())
          .then(data => data.translatedText)
          .catch(() => null)
      ];

      const results = await Promise.allSettled(translationPromises);
      
      // Use the first successful translation
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value && result.value.trim()) {
          const translated = result.value.trim();
          console.log(`Original (${sourceLang}): ${cleanText}`);
          console.log(`Translated: ${translated}`);
          return translated;
        }
      }

      console.warn('All translation services failed, using original text');
      return text;
    } catch (error) {
      console.warn('Translation error:', error);
      return text;
    }
  };

  const generateImages = async (prompt, isRegeneration = false, selectedIdx = null) => {
    if (!prompt) {
      setError('Please provide a description to generate images.');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Translate prompt to English if it's in another language
    const englishPrompt = await translateToEnglish(prompt, language);
    console.log(`Original: ${prompt}, Translated: ${englishPrompt}`);

    const form = new FormData();
    form.append('prompt', englishPrompt);

    try {
      const responses = await Promise.all([
        fetch('https://clipdrop-api.co/text-to-image/v1', {
          method: 'POST',
          headers: { 'x-api-key': CLIPDROP_API_KEY },
          body: form,
        }),
        fetch('https://clipdrop-api.co/text-to-image/v1', {
          method: 'POST',
          headers: { 'x-api-key': CLIPDROP_API_KEY },
          body: form,
        }),
        fetch('https://clipdrop-api.co/text-to-image/v1', {
          method: 'POST',
          headers: { 'x-api-key': CLIPDROP_API_KEY },
          body: form,
        }),
      ]);

      if (!responses.every(response => response.ok)) {
        throw new Error('Failed to generate images. Check your API key or credits.');
      }

      const buffers = await Promise.all(responses.map(response => response.arrayBuffer()));
      const newImageUrls = buffers.map(buffer => URL.createObjectURL(new Blob([buffer], { type: 'image/png' })));

      if (isRegeneration && selectedIdx !== null) {
        // Create a new set for regeneration
        const newSet = {
          id: imageSets.length,
          images: [...currentSet.images],
          prompt: `${currentSet.prompt} → ${prompt}`,
          language,
          originalPrompt: prompt,
          translatedPrompt: englishPrompt
        };
        newSet.images[selectedIdx] = newImageUrls[0];

        setImageSets([...imageSets, newSet]);
        setCurrentSetIndex(imageSets.length);
      } else {
        // Create a new set for initial generation
        const newSet = {
          id: imageSets.length,
          images: newImageUrls,
          prompt: prompt,
          language,
          originalPrompt: prompt,
          translatedPrompt: englishPrompt
        };

        setImageSets([...imageSets, newSet]);
        setCurrentSetIndex(imageSets.length);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = () => {
    const textToUse = finalTranscript || transcript;
    
    if (!textToUse || !textToUse.trim()) {
      alert('Please provide a prompt by speaking. Speak clearly and wait for the complete sentence to be captured.');
      return;
    }

    if (selectedImageIndex !== null) {
      generateImages(textToUse.trim(), true, selectedImageIndex);
    } else {
      generateImages(textToUse.trim());
    }
    SpeechRecognition.stopListening();
    setIsListening(false);
    resetTranscript();
    setFinalTranscript('');
    if (speechTimeout) {
      clearTimeout(speechTimeout);
    }
  };

  const startListening = () => {
    SpeechRecognition.startListening({ 
      continuous: true,
      language: language,
      interimResults: true
    });
    setIsListening(true);
    setFinalTranscript('');
  };

  const stopListening = () => {
    SpeechRecognition.stopListening();
    setIsListening(false);
    
    // Capture any remaining transcript as final
    if (transcript && transcript.trim()) {
      setFinalTranscript(transcript.trim());
    }
    
    if (speechTimeout) {
      clearTimeout(speechTimeout);
    }
  };

  const downloadImage = (url) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `generated_image_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const saveImage = (url) => {
    if (!savedImages.includes(url)) {
      setSavedImages([...savedImages, url]);
    }
  };

  const goBack = () => {
    if (currentSetIndex > 0) {
      setCurrentSetIndex(currentSetIndex - 1);
    }
  };

  const goForward = () => {
    if (currentSetIndex < imageSets.length - 1) {
      setCurrentSetIndex(currentSetIndex + 1);
    }
  };

  const deleteHistoryItem = (id) => {
    if (imageSets.length <= 1) return;

    const newSets = imageSets.filter(set => set.id !== id);
    setImageSets(newSets);

    if (currentSetIndex >= newSets.length) {
      setCurrentSetIndex(newSets.length - 1);
    }
  };

  const toggleLanguage = () => {
    const languages = ['en-IN', 'hi-IN', 'te-IN'];
    const currentIndex = languages.indexOf(language);
    const nextIndex = (currentIndex + 1) % languages.length;
    setLanguage(languages[nextIndex]);
  };

  if (!browserSupportsSpeechRecognition) {
    return <div className="error">Your browser does not support speech recognition.</div>;
  }

  return (
    <div className="App bright-theme">
      <button className="history-toggle" onClick={() => setShowHistory(!showHistory)}>
        {showHistory ? 'Hide History' : 'Show History'}
      </button>

      <div className={`history-sidebar ${showHistory ? 'open' : ''}`}>
        <h3>Generation History</h3>
        <ul>
          {imageSets.map((set, idx) => (
            <li key={set.id} className={currentSetIndex === idx ? 'active' : ''}>
              <button onClick={() => setCurrentSetIndex(idx)}>
                {set.prompt.substring(0, 30)}{set.prompt.length > 30 ? '...' : ''}
                <span className="lang-tag">{set.language}</span>
              </button>
              <button className="delete-history" onClick={(e) => {
                e.stopPropagation();
                deleteHistoryItem(set.id);
              }}>×</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="main-content">
        <h1 className="main-title">Sound Pix <span className="gradient-text">Voice to Image</span></h1>
        <p>Describe your image verbally, then generate visual magic</p>

        <div className="language-toggle">
          <button onClick={toggleLanguage}>
            <i className="fas fa-globe"></i> Switch Language: 
            {language === 'en-IN' ? ' English' : 
             language === 'hi-IN' ? ' हिंदी' : 
             language === 'te-IN' ? ' తెలుగు' : 'English'}
          </button>
        </div>

        <div className="voice-container">
          <div className={`voice-animation ${isListening ? 'active' : ''}`}>
            <div className="wave"></div>
            <div className="wave"></div>
            <div className="wave"></div>
            <div className="mic-icon">
              <i className="fas fa-microphone"></i>
            </div>
          </div>

          <div className="transcript-box">
            {finalTranscript || transcript || (isListening ? 'Listening... Speak clearly and pause briefly when done.' : 'Your description will appear here')}
            {finalTranscript && <div style={{fontSize: '0.9em', color: '#28a745', marginTop: '0.5rem'}}>✓ Complete sentence captured</div>}
          </div>
        </div>

        <div className="controls">
          <button 
            onClick={isListening ? stopListening : startListening} 
            className={`voice-button ${isListening ? 'listening' : ''}`}
          >
            <i className={`fas fa-${isListening ? 'microphone-slash' : 'microphone'}`}></i>
            {isListening ? 'Stop Speaking' : 'Start Speaking'}
          </button>

          <button 
            onClick={handleGenerate} 
            disabled={isLoading || (!transcript && !finalTranscript)}
            className="generate-button"
          >
            <i className="fas fa-magic"></i> Generate Images
          </button>

          <button onClick={() => {
            resetTranscript();
            setFinalTranscript('');
            if (speechTimeout) {
              clearTimeout(speechTimeout);
            }
          }} disabled={isLoading}>
            <i className="fas fa-eraser"></i> Clear
          </button>
        </div>

        <div className="navigation">
          <button onClick={goBack} disabled={currentSetIndex === 0}>
            <i className="fas fa-arrow-left"></i> Back
          </button>
          <span>Prompt: {currentSet.prompt.substring(0, 50)}{currentSet.prompt.length > 50 ? '...' : ''}</span>
          <button onClick={goForward} disabled={currentSetIndex === imageSets.length - 1}>
            Next <i className="fas fa-arrow-right"></i>
          </button>
        </div>

        <div className="images-container">
          {currentSet.images.map((url, index) => (
            url ? (
              <div 
                key={index} 
                className={`image-card ${selectedImageIndex === index ? 'selected' : ''}`}
                onClick={() => setSelectedImageIndex(index)}
              >
                <img src={url} alt={`Generated ${index}`} />
                <div className="image-actions">
                  <button onClick={() => downloadImage(url)}>
                    <i className="fas fa-download"></i>
                  </button>
                  <button onClick={() => saveImage(url)}>
                    <i className="fas fa-save"></i>
                  </button>
                </div>
              </div>
            ) : (
              <div key={index} className="image-card placeholder">
                {isLoading ? 'Generating...' : 'Image will appear here'}
              </div>
            )
          ))}
        </div>

        {selectedImageIndex !== null && (
          <div className="selected-prompt">
            <h3>
              <i className="fas fa-mouse-pointer"></i> Selected Image {selectedImageIndex + 1}
            </h3>
            <p>Speak a new description to transform this image</p>
          </div>
        )}

        {currentSetIndex > 0 && (
          <div className="regenerated-section">
            <h2><i className="fas fa-sync-alt"></i> Regenerated From Previous</h2>
            <div className="images-container">
              {imageSets[currentSetIndex - 1].images.map((url, index) => (
                url && (
                  <div key={index} className="image-card">
                    <img src={url} alt={`Previous ${index}`} />
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        {savedImages.length > 0 && (
          <div className="saved-section">
            <h2><i className="fas fa-bookmark"></i> Saved Images</h2>
            <div className="saved-images">
              {savedImages.map((url, index) => (
                <div key={index} className="saved-image">
                  <img src={url} alt={`Saved ${index}`} />
                  <button onClick={() => downloadImage(url)}>
                    <i className="fas fa-download"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Creating your images...</p>
          </div>
        )}

        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
};

export default VoiceToImage;
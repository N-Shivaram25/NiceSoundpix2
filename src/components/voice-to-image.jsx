
import React, { useState, useEffect } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import '../App.css';

const VoiceToImage = () => {
  const [currentMode, setCurrentMode] = useState('single'); // 'single' or 'saga'
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

  // Saga mode specific states
  const [sagaStory, setSagaStory] = useState([]);
  const [sagaImages, setSagaImages] = useState([]);
  const [currentSagaScene, setCurrentSagaScene] = useState(0);
  const [isEditingStory, setIsEditingStory] = useState(false);
  const [isPlayingStory, setIsPlayingStory] = useState(false);
  const [sagaProjects, setSagaProjects] = useState([]);
  
  const [pauseDetectionTimeout, setPauseDetectionTimeout] = useState(null);
  const [stopRecordingTimeout, setStopRecordingTimeout] = useState(null);
  const [showAddSceneModal, setShowAddSceneModal] = useState(false);
  const [newSceneText, setNewSceneText] = useState('');
  const [isAddingVoiceScene, setIsAddingVoiceScene] = useState(false);

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

  // Handle speech completion with pause detection for saga mode
  useEffect(() => {
    if (isListening && currentMode === 'saga' && transcript) {
      
      
      // Clear previous timeouts
      if (pauseDetectionTimeout) {
        clearTimeout(pauseDetectionTimeout);
      }
      if (stopRecordingTimeout) {
        clearTimeout(stopRecordingTimeout);
      }

      // 2-second pause detection for scene cutting
      const pauseTimeout = setTimeout(() => {
        if (transcript.trim()) {
          const currentScene = transcript.trim();
          console.log('Scene cut after 2-second pause:', currentScene);
          setSagaStory(prev => {
            // Avoid duplicates
            if (prev.length === 0 || prev[prev.length - 1] !== currentScene) {
              return [...prev, currentScene];
            }
            return prev;
          });
          resetTranscript();
        }
      }, 2000);

      // 5-second pause detection for stopping recording
      const stopTimeout = setTimeout(() => {
        if (transcript.trim()) {
          const currentScene = transcript.trim();
          setSagaStory(prev => {
            // Avoid duplicates
            if (prev.length === 0 || prev[prev.length - 1] !== currentScene) {
              return [...prev, currentScene];
            }
            return prev;
          });
          resetTranscript();
        }
        stopListening();
        console.log('Recording stopped after 5-second pause');
      }, 5000);

      setPauseDetectionTimeout(pauseTimeout);
      setStopRecordingTimeout(stopTimeout);
    } else if (transcript && isListening && currentMode === 'single') {
      // Original single mode logic
      if (speechTimeout) {
        clearTimeout(speechTimeout);
      }

      const timeout = setTimeout(() => {
        if (transcript.trim()) {
          setFinalTranscript(transcript.trim());
        }
      }, 2000);

      setSpeechTimeout(timeout);
    }

    return () => {
      if (pauseDetectionTimeout) {
        clearTimeout(pauseDetectionTimeout);
      }
      if (stopRecordingTimeout) {
        clearTimeout(stopRecordingTimeout);
      }
      if (speechTimeout) {
        clearTimeout(speechTimeout);
      }
    };
  }, [transcript, isListening, currentMode, pauseDetectionTimeout, stopRecordingTimeout, speechTimeout]);

  // Handle final transcript from speech recognition
  useEffect(() => {
    if (speechFinalTranscript && speechFinalTranscript.trim() && currentMode === 'single') {
      setFinalTranscript(speechFinalTranscript.trim());
    }
    // For saga mode, we handle transcripts through the pause detection logic only
  }, [speechFinalTranscript, currentMode]);

  

  const addNewScene = (sceneText) => {
    if (sceneText.trim()) {
      setSagaStory(prev => [...prev, sceneText.trim()]);
      setNewSceneText('');
      setShowAddSceneModal(false);
      setIsAddingVoiceScene(false);
    }
  };

  const startVoiceSceneRecording = () => {
    setIsAddingVoiceScene(true);
    setNewSceneText('');
    resetTranscript();
    SpeechRecognition.startListening({ 
      continuous: true,
      language: language,
      interimResults: true
    });
  };

  const stopVoiceSceneRecording = () => {
    SpeechRecognition.stopListening();
    setIsAddingVoiceScene(false);
    if (transcript.trim()) {
      addNewScene(transcript.trim());
      resetTranscript();
    }
  };

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

  const generateSagaImages = async () => {
    if (sagaStory.length === 0) {
      setError('Please record a story first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSagaImages([]);

    try {
      const imagePromises = sagaStory.map(async (scene, index) => {
        const englishPrompt = await translateToEnglish(scene, language);
        
        const form = new FormData();
        form.append('prompt', englishPrompt);

        const response = await fetch('https://clipdrop-api.co/text-to-image/v1', {
          method: 'POST',
          headers: { 'x-api-key': CLIPDROP_API_KEY },
          body: form,
        });

        if (!response.ok) {
          throw new Error(`Failed to generate image for scene ${index + 1}`);
        }

        const buffer = await response.arrayBuffer();
        const imageUrl = URL.createObjectURL(new Blob([buffer], { type: 'image/png' }));
        
        return {
          id: index,
          image: imageUrl,
          prompt: scene,
          translatedPrompt: englishPrompt
        };
      });

      const generatedImages = await Promise.all(imagePromises);
      setSagaImages(generatedImages);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = () => {
    if (currentMode === 'saga') {
      if (sagaStory.length === 0) {
        alert('Please record a story first by speaking into the microphone.');
        return;
      }
      generateSagaImages();
    } else {
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
    resetTranscript();
    SpeechRecognition.startListening({ 
      continuous: true,
      language: language,
      interimResults: true
    });
    setIsListening(true);
    setFinalTranscript('');
    // Don't reset saga story when starting listening, only when explicitly clearing
  };

  const stopListening = () => {
    SpeechRecognition.stopListening();
    setIsListening(false);
    
    // Capture any remaining transcript as final for saga mode only if it's different
    if (transcript && transcript.trim() && currentMode === 'saga') {
      const currentScene = transcript.trim();
      setSagaStory(prev => {
        // Only add if it's different from the last scene
        if (prev.length === 0 || prev[prev.length - 1] !== currentScene) {
          return [...prev, currentScene];
        }
        return prev;
      });
      resetTranscript();
    } else if (transcript && transcript.trim() && currentMode === 'single') {
      setFinalTranscript(transcript.trim());
    }
    
    // Clear all timeouts
    if (speechTimeout) {
      clearTimeout(speechTimeout);
    }
    if (pauseDetectionTimeout) {
      clearTimeout(pauseDetectionTimeout);
    }
    if (stopRecordingTimeout) {
      clearTimeout(stopRecordingTimeout);
    }
  };

  const saveSagaProject = () => {
    if (sagaStory.length === 0 || sagaImages.length === 0) {
      alert('Please generate a complete saga first.');
      return;
    }

    const project = {
      id: Date.now(),
      name: `Story Project ${sagaProjects.length + 1}`,
      story: sagaStory,
      images: sagaImages,
      createdAt: new Date().toLocaleDateString()
    };

    setSagaProjects([...sagaProjects, project]);
    alert('Saga project saved successfully!');
  };

  const playStory = () => {
    if (sagaStory.length === 0) {
      alert('No story to play. Please record a story first.');
      return;
    }

    setIsPlayingStory(true);
    setCurrentSagaScene(0);

    // Simple slideshow implementation
    let sceneIndex = 0;
    const interval = setInterval(() => {
      if (sceneIndex < sagaStory.length - 1) {
        sceneIndex++;
        setCurrentSagaScene(sceneIndex);
      } else {
        clearInterval(interval);
        setIsPlayingStory(false);
        setCurrentSagaScene(0);
      }
    }, 3000); // 3 seconds per scene
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

  const exportSagaData = () => {
    if (sagaStory.length === 0 && sagaImages.length === 0) {
      alert('No saga data to export.');
      return;
    }

    const exportData = {
      story: sagaStory,
      images: sagaImages.map(img => ({ ...img, image: 'blob_url_placeholder' })),
      exportedAt: new Date().toISOString()
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `saga_export_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

  const updateStoryLine = (index, newText) => {
    const updatedStory = [...sagaStory];
    updatedStory[index] = newText;
    setSagaStory(updatedStory);
  };

  if (!browserSupportsSpeechRecognition) {
    return <div className="error">Your browser does not support speech recognition.</div>;
  }

  return (
    <div className="App bright-theme">
      {/* Header Navigation */}
      <header className="header-nav">
        <div className="nav-left">
          <button 
            className={`nav-button ${currentMode === 'saga' ? 'active' : ''}`}
            onClick={() => setCurrentMode('saga')}
          >
            <i className="fas fa-book"></i> Voice to Saga Mode
          </button>
          <button className="nav-button" onClick={() => alert('Voice to Video feature coming soon!')}>
            <i className="fas fa-video"></i> Voice to Video Generate
          </button>
          <button className="nav-button" onClick={() => alert('Custom design feature coming soon!')}>
            <i className="fas fa-palette"></i> Your Design
          </button>
          <button className="nav-button" onClick={exportSagaData}>
            <i className="fas fa-download"></i> Export
          </button>
        </div>
        <div className="nav-right">
          <button className="nav-button profile-icon">
            <i className="fas fa-user-circle"></i>
          </button>
        </div>
      </header>

      <button className="history-toggle" onClick={() => setShowHistory(!showHistory)}>
        {showHistory ? 'Hide History' : 'Show History'}
      </button>

      <div className={`history-sidebar ${showHistory ? 'open' : ''}`}>
        <h3>{currentMode === 'saga' ? 'Saga Projects' : 'Generation History'}</h3>
        <ul>
          {currentMode === 'saga' ? (
            sagaProjects.map((project, idx) => (
              <li key={project.id}>
                <button onClick={() => {
                  setSagaStory(project.story);
                  setSagaImages(project.images);
                }}>
                  {project.name}
                  <span className="date-tag">{project.createdAt}</span>
                </button>
              </li>
            ))
          ) : (
            imageSets.map((set, idx) => (
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
            ))
          )}
        </ul>
      </div>

      <div className="main-content">
        <h1 className="main-title">
          Sound Pix <span className="gradient-text">
            {currentMode === 'saga' ? 'Voice to Saga' : 'Voice to Image'}
          </span>
        </h1>
        <p>
          {currentMode === 'saga' 
            ? 'Tell a story and watch it come to life through AI-generated images'
            : 'Describe your image verbally, then generate visual magic'
          }
        </p>

        <div className="language-toggle">
          <button onClick={toggleLanguage}>
            <i className="fas fa-globe"></i> Switch Language: 
            {language === 'en-IN' ? ' English' : 
             language === 'hi-IN' ? ' हिंदी' : 
             language === 'te-IN' ? ' తెలుగు' : 'English'}
          </button>
        </div>

        {currentMode === 'saga' ? (
          // Saga Mode UI
          <div className="saga-mode">
            {/* Add Scene Button */}
            <button 
              className="add-scene-button"
              onClick={() => setShowAddSceneModal(true)}
              title="Add New Scene"
            >
              <i className="fas fa-plus"></i>
            </button>

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
                <div className="current-language-indicator">
                  <i className="fas fa-globe"></i> 
                  {language === 'en-IN' ? 'English' : 
                   language === 'hi-IN' ? 'हिंदी' : 
                   language === 'te-IN' ? 'తెలుగు' : 'English'}
                </div>
                {sagaStory.length > 0 ? (
                  <div className="story-preview">
                    <h4>Your Story ({sagaStory.length} scenes):</h4>
                    {sagaStory.map((scene, index) => (
                      <div key={index} className="story-scene">
                        <span className="scene-number">Scene {index + 1}:</span>
                        {isEditingStory ? (
                          <input 
                            type="text" 
                            value={scene}
                            onChange={(e) => updateStoryLine(index, e.target.value)}
                            className="story-edit-input"
                          />
                        ) : (
                          <span className="scene-text">{scene}</span>
                        )}
                      </div>
                    ))}
                    {isListening && transcript && (
                      <div className="current-scene">
                        <span className="scene-number">Scene {sagaStory.length + 1} (Recording...):</span>
                        <span className="scene-text">{transcript}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  transcript || (isListening ? 'Tell your story... Pause for 2 seconds to cut scenes, 5 seconds to stop recording.' : 'Your story will appear here as you speak')
                )}
              </div>
            </div>

            <div className="saga-controls">
              <button 
                onClick={isListening ? stopListening : startListening} 
                className={`voice-button ${isListening ? 'listening' : ''}`}
              >
                <i className={`fas fa-${isListening ? 'microphone-slash' : 'microphone'}`}></i>
                {isListening ? 'Stop Recording' : 'Start Recording Story'}
              </button>

              {sagaStory.length > 0 && (
                <>
                  <button 
                    onClick={() => setIsEditingStory(!isEditingStory)}
                    className="edit-button"
                  >
                    <i className="fas fa-edit"></i> {isEditingStory ? 'Done Editing' : 'Edit Story'}
                  </button>

                  <button 
                    onClick={handleGenerate} 
                    disabled={isLoading}
                    className="generate-button"
                  >
                    <i className="fas fa-magic"></i> Generate All Images
                  </button>

                  {sagaImages.length > 0 && (
                    <>
                      <button onClick={playStory} disabled={isPlayingStory} className="play-button">
                        <i className="fas fa-play"></i> Play Story
                      </button>
                      <button onClick={saveSagaProject} className="save-button">
                        <i className="fas fa-save"></i> Save Project
                      </button>
                    </>
                  )}
                </>
              )}

              <button onClick={() => {
                resetTranscript();
                setSagaStory([]);
                setSagaImages([]);
                setCurrentSagaScene(0);
              }} disabled={isLoading}>
                <i className="fas fa-eraser"></i> Clear All
              </button>
            </div>

            {/* Saga Images Display */}
            {sagaImages.length > 0 && (
              <div className="saga-storyboard">
                <h3>
                  <i className="fas fa-images"></i> Your Story Storyboard
                  {isPlayingStory && ` - Scene ${currentSagaScene + 1}`}
                </h3>
                <div className="storyboard-container">
                  {sagaImages.map((sceneData, index) => (
                    <div 
                      key={index} 
                      className={`storyboard-scene ${isPlayingStory && index === currentSagaScene ? 'active-scene' : ''}`}
                    >
                      <div className="scene-number-badge">Scene {index + 1}</div>
                      <img src={sceneData.image} alt={`Scene ${index + 1}`} />
                      <div className="scene-text">{sceneData.prompt}</div>
                      <div className="scene-actions">
                        <button onClick={() => downloadImage(sceneData.image)}>
                          <i className="fas fa-download"></i>
                        </button>
                        <button onClick={() => saveImage(sceneData.image)}>
                          <i className="fas fa-save"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Scene Modal */}
            {showAddSceneModal && (
              <div className="modal-overlay" onClick={() => setShowAddSceneModal(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <h3>Add New Scene</h3>
                  <div className="current-language-display">
                    <i className="fas fa-globe"></i> Recording in: 
                    {language === 'en-IN' ? ' English' : 
                     language === 'hi-IN' ? ' हिंदी' : 
                     language === 'te-IN' ? ' తెలుగు' : ' English'}
                  </div>
                  <div className="add-scene-options">
                    <div className="text-input-section">
                      <textarea
                        value={newSceneText}
                        onChange={(e) => setNewSceneText(e.target.value)}
                        placeholder={
                          language === 'hi-IN' ? 'यहाँ अपना नया दृश्य लिखें...' :
                          language === 'te-IN' ? 'మీ కొత్త దృశ్యాన్ని ఇక్కడ టైప్ చేయండి...' :
                          'Type your new scene here...'
                        }
                        rows={4}
                        className="scene-textarea"
                      />
                      <button 
                        onClick={() => addNewScene(newSceneText)}
                        disabled={!newSceneText.trim()}
                        className="add-text-scene-btn"
                      >
                        <i className="fas fa-plus"></i> Add Text Scene
                      </button>
                    </div>
                    
                    <div className="voice-input-section">
                      <div className="voice-recording-status">
                        {isAddingVoiceScene ? (
                          <>
                            <div className="recording-indicator">
                              <div className="pulse-dot"></div>
                              {language === 'hi-IN' ? 'रिकॉर्डिंग... समाप्त होने पर स्टॉप क्लिक करें' :
                               language === 'te-IN' ? 'రికార్డింగ్... పూర్తయినప్పుడు స్టాప్ క్లిక్ చేయండి' :
                               'Recording... Click stop when done'}
                            </div>
                            <div className="live-transcript">
                              {transcript || (
                                language === 'hi-IN' ? 'अपना दृश्य बोलें...' :
                                language === 'te-IN' ? 'మీ దృశ్యాన్ని మాట్లాడండి...' :
                                'Speak your scene...'
                              )}
                            </div>
                          </>
                        ) : (
                          language === 'hi-IN' ? 'आवाज़ के साथ अपना दृश्य रिकॉर्ड करने के लिए क्लिक करें' :
                          language === 'te-IN' ? 'వాయిస్‌తో మీ దృశ్యాన్ని రికార్డ్ చేయడానికి క్లిక్ చేయండి' :
                          'Click to record your scene with voice'
                        )}
                      </div>
                      <button 
                        onClick={isAddingVoiceScene ? stopVoiceSceneRecording : startVoiceSceneRecording}
                        className={`add-voice-scene-btn ${isAddingVoiceScene ? 'recording' : ''}`}
                      >
                        <i className={`fas fa-${isAddingVoiceScene ? 'stop' : 'microphone'}`}></i>
                        {isAddingVoiceScene ? 'Stop Recording' : 'Record Voice Scene'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="modal-actions">
                    <button onClick={() => setShowAddSceneModal(false)} className="cancel-btn">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Original Single Image Mode UI
          <>
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
          </>
        )}

        {isLoading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>{currentMode === 'saga' ? 'Creating your story images...' : 'Creating your images...'}</p>
          </div>
        )}

        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
};

export default VoiceToImage;

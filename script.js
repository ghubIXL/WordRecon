// --- Web Speech API Logic ---
if ('speechSynthesis' in window) {
    const synth = window.speechSynthesis;
    const wordButtonsContainer = document.getElementById('wordButtonsContainer');
    const voiceSelect = document.getElementById('voiceSelect');
    // REMOVED: const jsonFileLoader = document.getElementById('jsonFileLoader');
    const loadingStatus = document.getElementById('loadingStatus'); // Still useful for initial load message

    const textBox1 = document.getElementById('textBox1');
    const textBox2 = document.getElementById('textBox2');
    const speakFirstWordButton = document.getElementById('speakFirstWordButton');
    const speakSecondWordButton = document.getElementById('speakSecondWordButton');
    const speakCustomPairButton = document.getElementById('speakCustomPairButton');

    const pauseSlider = document.getElementById('pauseSlider');
    const pauseValue = document.getElementById('pauseValue');
    const stickyControls = document.getElementById('stickyControls');
    const mainContentWrapper = document.getElementById('mainContentWrapper');

    let availableVoices = [];
    let currentTimeoutId = null;
    let currentPauseDurationMs = parseInt(pauseSlider.value);

    // --- Voice Loading State ---
    let voicesLoadedSuccessfully = false; // Flag to track if voices have populated
    let voiceLoadRetries = 0;
    const MAX_VOICE_RETRIES = 10;
    const VOICE_RETRY_DELAY = 200;

    function populateVoiceList() {
        const currentVoices = synth.getVoices().sort((a, b) => {
            const aname = a.name.toUpperCase();
            const bname = b.name.toUpperCase();
            if (aname < bname) return -1;
            if (aname > bname) return +1;
            return 0;
        });

        // If voices are available, update the UI and set success flag
        if (currentVoices.length > 0) {
            availableVoices = currentVoices; // Update the global variable
            voiceSelect.innerHTML = ''; // Clear existing options
            let defaultVoiceSelected = false;

            availableVoices.forEach((voice) => {
                const option = document.createElement('option');
                option.textContent = `${voice.name} (${voice.lang})`;
                if (voice.lang === 'en-US' && !defaultVoiceSelected) {
                    option.selected = true;
                    defaultVoiceSelected = true;
                }
                option.setAttribute('data-lang', voice.lang);
                option.setAttribute('data-name', voice.name);
                voiceSelect.appendChild(option);
            });

            if (!defaultVoiceSelected) {
                const enGBVoice = availableVoices.find(voice => voice.lang === 'en-GB');
                if (enGBVoice) {
                    voiceSelect.querySelector(`option[data-name="${enGBVoice.name}"]`).selected = true;
                }
            }
            console.log("Voice list populated. Total voices:", availableVoices.length);
            voicesLoadedSuccessfully = true; // Mark as loaded
            voiceLoadRetries = 0; // Reset retry counter on success
            return; // Exit here, voices are loaded
        }

        // If voices are NOT available, proceed with retry logic
        if (voiceLoadRetries < MAX_VOICE_RETRIES) {
            console.warn("No voices available yet, retrying...", voiceLoadRetries + 1);
            voiceLoadRetries++;
            setTimeout(populateVoiceList, VOICE_RETRY_DELAY); // Retry after a short delay
            // Update UI to show loading state if not already
            if (voiceSelect.innerHTML === '' || voiceSelect.querySelector('option').value !== 'loading') {
                voiceSelect.innerHTML = '<option value="loading">Loading voices...</option>';
            }
            return;
        } else {
            console.error("Failed to load voices after multiple retries. Please try interacting with the page, refreshing, or ensure voices are installed on your device.");
            voiceSelect.innerHTML = '<option value="">No Voices Available</option>'; // Show a message
            voicesLoadedSuccessfully = false; // Mark as failed
        }
    }

    // --- Voice Initialization Strategy for Mobile ---
    if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = () => {
            if (!voicesLoadedSuccessfully) {
                populateVoiceList();
            }
        };
    }

    let firstInteractionDone = false;
    function handleFirstInteraction() {
        if (!firstInteractionDone) {
            firstInteractionDone = true;
            console.log("First user interaction detected. Attempting to populate voices.");
            populateVoiceList();
            document.removeEventListener('click', handleFirstInteraction);
            document.removeEventListener('touchstart', handleFirstInteraction);
        }
    }
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);


    function getSelectedVoice() {
        const selectedVoiceName = voiceSelect.selectedOptions[0]?.getAttribute('data-name');
        return availableVoices.find(voice => voice.name === selectedVoiceName) || null;
    }

    function speakWord(word) {
        if (synth.speaking) {
            synth.cancel();
        }
        if (currentTimeoutId) {
            clearTimeout(currentTimeoutId);
            currentTimeoutId = null;
        }

        const utterance = new SpeechSynthesisUtterance(word);
        const voice = getSelectedVoice();
        if (voice) {
            utterance.voice = voice;
        } else if (availableVoices.length > 0) {
            utterance.voice = availableVoices[0];
            console.warn("Selected voice not found, falling back to first available voice.");
        } else {
            console.warn("No specific voice selected or available. Browser will use default.");
        }
        utterance.pitch = 1;
        utterance.rate = 1;
        utterance.onerror = (event) => console.error("Speech error for single word:", event.error, word);
        synth.speak(utterance);
    }

    function speakPair(word1, word2) {
        if (synth.speaking) {
            synth.cancel();
        }
        if (currentTimeoutId) {
            clearTimeout(currentTimeoutId);
            currentTimeoutId = null;
        }

        const selectedVoice = getSelectedVoice();
        if (!selectedVoice && availableVoices.length === 0) {
            console.warn("No voices available to speak. Please try interacting with the page first or ensure voices are installed.");
            if (!voicesLoadedSuccessfully) {
                 populateVoiceList();
            }
            return;
        }

        const utterance1 = new SpeechSynthesisUtterance(word1);
        utterance1.voice = selectedVoice || (availableVoices.length > 0 ? availableVoices[0] : null);
        utterance1.pitch = 1;
        utterance1.rate = 1;
        utterance1.onerror = (event) => console.error("Error speaking word 1 in pair:", event.error, word1);
        utterance1.onend = () => {
            currentTimeoutId = setTimeout(() => {
                const utterance2 = new SpeechSynthesisUtterance(word2);
                utterance2.voice = selectedVoice || (availableVoices.length > 0 ? availableVoices[0] : null);
                utterance2.pitch = 1;
                utterance2.rate = 1;
                utterance2.onerror = (event) => console.error("Error speaking word 2 in pair:", event.error, word2);
                synth.speak(utterance2);
                currentTimeoutId = null;
            }, currentPauseDurationMs);
        };
        synth.speak(utterance1);
    }

    function generateButtons(wordData) {
        wordButtonsContainer.innerHTML = '';
        if (!wordData || wordData.length === 0) {
            wordButtonsContainer.innerHTML = '<p>No word data loaded. Please select a valid JSON file.</p>';
            return;
        }

        wordData.forEach(categoryObj => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category-container';
            categoryDiv.innerHTML = `<h2>${categoryObj.category}</h2>`;
            wordButtonsContainer.appendChild(categoryDiv);

            const subcategoryArray = categoryObj.subcategories || [{ name: "", contrasts: categoryObj.contrasts }];

            subcategoryArray.forEach(subcategoryObj => {
                const subcategoryDiv = document.createElement('div');
                subcategoryDiv.className = 'subcategory-container';
                if (subcategoryObj.name) {
                    subcategoryDiv.innerHTML = `<h3>${subcategoryObj.name}</h3>`;
                }
                categoryDiv.appendChild(subcategoryDiv);

                subcategoryObj.contrasts.forEach(contrastObj => {
                    const contrastGroupDiv = document.createElement('div');
                    contrastGroupDiv.className = 'contrast-group';
                    contrastGroupDiv.innerHTML = `<h4>Contrast: ${contrastObj.description}</h4>`;
                    subcategoryDiv.appendChild(contrastGroupDiv);

                    contrastObj.pairs.forEach(pair => {
                        const pairDiv = document.createElement('div');
                        pairDiv.className = 'button-pair';

                        const button1 = document.createElement('button');
                        button1.textContent = pair[0];
                        button1.setAttribute('data-word1', pair[0]);
                        pairDiv.appendChild(button1);

                        const button2 = document.createElement('button');
                        button2.textContent = pair[1];
                        button2.setAttribute('data-word2', pair[1]);
                        pairDiv.appendChild(button2);

                        const speakPairButton = document.createElement('button');
                        speakPairButton.textContent = "Listen Pair";
                        speakPairButton.className = "listen-pair";
                        speakPairButton.setAttribute('data-word-pair-1', pair[0]);
                        speakPairButton.setAttribute('data-word-pair-2', pair[1]);
                        pairDiv.appendChild(speakPairButton);

                        contrastGroupDiv.appendChild(pairDiv);
                    });
                });
            });
        });
    }

    // --- AUTOMATIC JSON Loading Logic (NEW) ---
    // This replaces the old jsonFileLoader input and event listener.
    // Make sure your words.json file is in the same directory as your index.html
    // on GitHub Pages, or adjust the path if it's in a subfolder (e.g., './data/words.json').
    const JSON_FILE_PATH = 'words.json'; // IMPORTANT: Adjust this path if your JSON file is not in the root

    async function loadJsonDataAutomatically() {
        loadingStatus.textContent = `Loading "${JSON_FILE_PATH}"...`;
        try {
            const response = await fetch(JSON_FILE_PATH);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const jsonData = await response.json();
            generateButtons(jsonData);
            loadingStatus.textContent = `"${JSON_FILE_PATH}" loaded successfully!`;
            // Remove the file input section from HTML after successful load
            // This assumes your HTML structure has a div with class "file-input-section"
            const fileInputSection = document.querySelector('.file-input-section');
            if (fileInputSection) {
                fileInputSection.style.display = 'none'; // Hide the input section
            }
        } catch (error) {
            loadingStatus.textContent = `Error loading JSON from "${JSON_FILE_PATH}": ${error.message}. Please ensure the file is correctly placed on GitHub Pages.`;
            console.error("Error fetching JSON:", error);
            wordButtonsContainer.innerHTML = '<p style="color: red;">Error loading word data. Please ensure <code>words.json</code> is accessible.</p>';
        }
    }

    // Call the automatic loader when the window loads
    window.addEventListener('load', () => {
        loadJsonDataAutomatically(); // Initiate JSON loading
        // Also run the sticky controls height adjustment
        const controlsHeight = stickyControls.offsetHeight;
        mainContentWrapper.style.marginTop = controlsHeight + 'px';
        console.log("Sticky controls height:", controlsHeight, "px. Set main content margin-top.");
    });


    // --- Event Listeners for new custom text boxes/buttons ---
    speakFirstWordButton.addEventListener('click', () => {
        speakWord(textBox1.value);
    });

    speakSecondWordButton.addEventListener('click', () => {
        speakWord(textBox2.value);
    });

    speakCustomPairButton.addEventListener('click', () => {
        speakPair(textBox1.value, textBox2.value);
    });

    // --- Event Listener for Pause Slider ---
    pauseSlider.addEventListener('input', () => {
        currentPauseDurationMs = parseInt(pauseSlider.value);
        pauseValue.textContent = (currentPauseDurationMs / 1000).toFixed(1) + " sec";
    });


    // --- Event Delegation for Generated Buttons ---
    wordButtonsContainer.addEventListener('click', (event) => {
        const target = event.target;
        if (target.tagName === 'BUTTON') {
            if (target.hasAttribute('data-word1') && !target.hasAttribute('data-word-pair-1')) {
                speakWord(target.getAttribute('data-word1'));
            } else if (target.hasAttribute('data-word2')) {
                speakWord(target.getAttribute('data-word2'));
            } else if (target.hasAttribute('data-word-pair-1')) {
                const word1 = target.getAttribute('data-word-pair-1');
                const word2 = target.getAttribute('data-word-pair-2');
                speakPair(word1, word2);
            }
        }
    });

} else {
    alert('Your browser does not support the Web Speech API.');
}

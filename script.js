   // --- Web Speech API Logic ---
    if ('speechSynthesis' in window) {
        const synth = window.speechSynthesis;
        const wordButtonsContainer = document.getElementById('wordButtonsContainer');
        const voiceSelect = document.getElementById('voiceSelect');
        const jsonFileLoader = document.getElementById('jsonFileLoader');
        const loadingStatus = document.getElementById('loadingStatus');

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

        // --- Voice Loading Retry Variables ---
        let voiceLoadRetries = 0;
        const MAX_VOICE_RETRIES = 10; // Try up to 10 times
        const VOICE_RETRY_DELAY = 200; // Wait 200ms between retries

        function populateVoiceList() {
            availableVoices = synth.getVoices().sort((a, b) => {
                const aname = a.name.toUpperCase();
                const bname = b.name.toUpperCase();
                if (aname < bname) return -1;
                if (aname > bname) return +1;
                return 0;
            });

            // --- Retry logic for Firefox ---
            if (availableVoices.length === 0 && voiceLoadRetries < MAX_VOICE_RETRIES) {
                console.warn("No voices available yet, retrying...", voiceLoadRetries + 1);
                voiceLoadRetries++;
                setTimeout(populateVoiceList, VOICE_RETRY_DELAY); // Retry after a short delay
                return; // Exit this call, wait for retry
            } else if (availableVoices.length === 0 && voiceLoadRetries >= MAX_VOICE_RETRIES) {
                console.error("Failed to load voices after multiple retries. Please try refreshing or ensure voices are installed.");
                voiceSelect.innerHTML = '<option value="">No Voices Available</option>'; // Show a message
                return; // Stop trying
            }
            // --- End Retry Logic ---

            voiceSelect.innerHTML = '';
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
            voiceLoadRetries = 0; // Reset retry counter on success
        }

        // Event listener for voices changed (standard approach)
        if (synth.onvoiceschanged !== undefined) {
            synth.onvoiceschanged = populateVoiceList;
        }

        // Initial call to populate. If voices aren't ready, the retry logic handles it.
        populateVoiceList();

        function getSelectedVoice() {
            const selectedVoiceName = voiceSelect.selectedOptions[0].getAttribute('data-name');
            return availableVoices.find(voice => voice.name === selectedVoiceName);
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
            utterance.voice = getSelectedVoice();
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
            if (!selectedVoice) {
                console.warn("No voice selected or available. Cannot speak pair.");
                return;
            }

            const utterance1 = new SpeechSynthesisUtterance(word1);
            utterance1.voice = selectedVoice;
            utterance1.pitch = 1;
            utterance1.rate = 1;
            utterance1.onerror = (event) => console.error("Error speaking word 1 in pair:", event.error, word1);
            utterance1.onend = () => {
                currentTimeoutId = setTimeout(() => {
                    const utterance2 = new SpeechSynthesisUtterance(word2);
                    utterance2.voice = selectedVoice;
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

        // --- File Loader Logic ---
        jsonFileLoader.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) {
                loadingStatus.textContent = "No file selected.";
                wordButtonsContainer.innerHTML = '';
                return;
            }

            if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
                loadingStatus.textContent = "Please select a valid JSON file (.json extension or application/json type).";
                wordButtonsContainer.innerHTML = '';
                return;
            }

            loadingStatus.textContent = `Loading "${file.name}"...`;

            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const jsonData = JSON.parse(e.target.result);
                    generateButtons(jsonData);
                    loadingStatus.textContent = `"${file.name}" loaded successfully!`;
                } catch (error) {
                    loadingStatus.textContent = `Error parsing JSON from "${file.name}": ${error.message}`;
                    console.error("Error parsing JSON:", error);
                    wordButtonsContainer.innerHTML = '<p style="color: red;">Error parsing JSON from selected file. Please ensure it\'s valid JSON.</p>';
                }
            };

            reader.onerror = (e) => {
                loadingStatus.textContent = `Error reading file: ${reader.error.name}`;
                console.error("Error reading file:", reader.error);
                wordButtonsContainer.innerHTML = '<p style="color: red;">Error reading the selected file.</p>';
            };

            reader.readAsText(file);
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

        // --- Fix for initial empty space ---
        window.addEventListener('load', () => {
            const controlsHeight = stickyControls.offsetHeight;
            mainContentWrapper.style.marginTop = controlsHeight + 'px';
            console.log("Sticky controls height:", controlsHeight, "px. Set main content margin-top.");
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
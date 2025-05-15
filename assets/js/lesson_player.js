// assets/js/lesson_player.js
var player;
var allParagraphsData = [];
var autoScrollTranscriptEnabled = true;

var currentActiveParagraphContainer = null;
var currentActiveSentence = null;

var mainContentAreaEl;
var videoTimeUpdaterInterval;

var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
if (firstScriptTag) {
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
} else {
    document.head.appendChild(tag);
}

function onYouTubeIframeAPIReady() {
    if (typeof window.YT_VIDEO_ID === 'undefined') {
        console.error("YT_VIDEO_ID not found on window object.");
        const playerDiv = document.getElementById('youtube-player-iframe');
        if(playerDiv) playerDiv.innerHTML = "<p style='color:red; padding:20px; text-align:center;'>Error: Video ID missing.</p>";
        return;
    }
    player = new YT.Player('youtube-player-iframe', {
        videoId: window.YT_VIDEO_ID,
        playerVars: { 'playsinline': 1, 'rel': 0, 'modestbranding': 1, 'origin': window.location.origin },
        events: { 'onReady': onPlayerReady, 'onStateChange': onPlayerStateChange }
    });
}

function onPlayerReady(event) {
    mainContentAreaEl = document.getElementById('mainContentArea');
    
    const transcriptDataElem = document.getElementById('allTranscriptData');
    if (transcriptDataElem && transcriptDataElem.textContent) {
        try { 
            allParagraphsData = JSON.parse(transcriptDataElem.textContent); 
            generateCombinedTranscript();
        }
        catch (e) { 
            console.error("Parse allTranscriptData failed:", e);
            const tcEl = document.getElementById('mainContentArea');
            if(tcEl) tcEl.innerHTML = "<p class='no-transcript-message'>Error loading transcript.</p>"; 
            return; 
        }
    }
    if (allParagraphsData.length === 0) {
        const tcEl = document.getElementById('mainContentArea');
        if(tcEl && !tcEl.querySelector('.no-transcript-message')) { // Avoid duplicate messages
             tcEl.innerHTML = "<p class='no-transcript-message'>No transcript data found.</p>";
        }
    }

    setupClickHandlers();

    const autoScrollCheckbox = document.getElementById('autoScrollTranscriptCheckbox');
    if (autoScrollCheckbox) {
        autoScrollTranscriptEnabled = autoScrollCheckbox.checked;
        autoScrollCheckbox.addEventListener('change', function() { 
            autoScrollTranscriptEnabled = this.checked; 
        });
    }

    const minimalVideoToggle = document.getElementById('minimalVideoToggle');
    if (minimalVideoToggle) {
        const minimalMode = localStorage.getItem('videoMinimalMode') === 'true';
        if (minimalMode) {
            document.body.classList.add('video-minimal-mode');
            minimalVideoToggle.checked = true;
        }
        minimalVideoToggle.addEventListener('change', function() {
            if (this.checked) {
                document.body.classList.add('video-minimal-mode');
                localStorage.setItem('videoMinimalMode', 'true');
            } else {
                document.body.classList.remove('video-minimal-mode');
                localStorage.setItem('videoMinimalMode', 'false');
            }
        });
    }
}

function formatTimestamp(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function generateCombinedTranscript() {
    if (!mainContentAreaEl || allParagraphsData.length === 0) return;
    
    // Create a container for the timeline connection line
    const timelineConnection = document.createElement('div');
    timelineConnection.className = 'timeline-connection';
    mainContentAreaEl.appendChild(timelineConnection);
    
    // Clear existing content
    const existingContent = Array.from(mainContentAreaEl.querySelectorAll('.paragraph-container'));
    existingContent.forEach(el => el.remove());
    
    // Generate new combined paragraph containers
    allParagraphsData.forEach((paragraph, index) => {
        const paragraphContainer = document.createElement('div');
        paragraphContainer.className = 'paragraph-container';
        paragraphContainer.dataset.paragraphIdx = paragraph.paragraph_idx;
        paragraphContainer.dataset.startTime = paragraph.start;
        paragraphContainer.dataset.endTime = paragraph.end;
        paragraphContainer.dataset.paragraphId = paragraph.id;
        
        // Create timeline component
        const timelineComponent = document.createElement('div');
        timelineComponent.className = 'paragraph-timeline';
        
        const dotContainer = document.createElement('div');
        dotContainer.className = 'paragraph-timeline-dot-container';
        
        const dot = document.createElement('div');
        dot.className = 'paragraph-timeline-dot';
        dotContainer.appendChild(dot);
        
        const timestamp = document.createElement('div');
        timestamp.className = 'paragraph-timeline-timestamp';
        timestamp.textContent = formatTimestamp(paragraph.start);
        
        timelineComponent.appendChild(dotContainer);
        timelineComponent.appendChild(timestamp);
        
        // Create paragraph text component
        const paragraphText = document.createElement('div');
        paragraphText.className = 'paragraph-text';
        paragraphText.id = `text-${paragraph.id}`;
        
        // Add sentences to the paragraph
        paragraph.sentences.forEach(sentence => {
            const sentenceEl = document.createElement('span');
            sentenceEl.className = 'transcript-sentence';
            sentenceEl.id = sentence.id;
            sentenceEl.textContent = sentence.text;
            sentenceEl.dataset.startTime = sentence.start;
            sentenceEl.dataset.endTime = sentence.end;
            
            // Add click event for sentence seeking
            sentenceEl.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering paragraph click
                const startTime = parseFloat(sentence.start);
                if (player && player.seekTo) { 
                    player.seekTo(startTime, true); 
                    if (player.getPlayerState() !== YT.PlayerState.PLAYING) player.playVideo(); 
                }
            });
            
            paragraphText.appendChild(sentenceEl);
            // Add a space after each sentence
            paragraphText.appendChild(document.createTextNode(' '));
        });
        
        // Assemble container
        paragraphContainer.appendChild(timelineComponent);
        paragraphContainer.appendChild(paragraphText);
        
        // Add click event for paragraph seeking
        paragraphContainer.addEventListener('click', () => {
            const startTime = parseFloat(paragraph.start);
            if (player && player.seekTo) { 
                player.seekTo(startTime, true); 
                if (player.getPlayerState() !== YT.PlayerState.PLAYING) player.playVideo(); 
            }
        });
        
        mainContentAreaEl.appendChild(paragraphContainer);
    });
    
    // Start the video time updater
    startVideoTimeUpdater();
}

function setupClickHandlers() {
    // All click handlers are now set up in the generateCombinedTranscript function
    // for both paragraphs and sentences
}

function onPlayerStateChange(event) { 
    if (event.data === YT.PlayerState.PLAYING) startVideoTimeUpdater(); 
    else stopVideoTimeUpdater(); 
}

function startVideoTimeUpdater() { 
    if (videoTimeUpdaterInterval) clearInterval(videoTimeUpdaterInterval); 
    videoTimeUpdaterInterval = setInterval(updateHighlightsBasedOnVideoTime, 180); 
}

function stopVideoTimeUpdater() { 
    clearInterval(videoTimeUpdaterInterval); 
}

function updateActiveParagraph(paragraphContainer, shouldScroll = false) {
    if (currentActiveParagraphContainer !== paragraphContainer) {
        if (currentActiveParagraphContainer) {
            currentActiveParagraphContainer.classList.remove('active');
        }
        
        if (paragraphContainer) {
            paragraphContainer.classList.add('active');
            
            // Scroll to paragraph if needed
            if (shouldScroll && autoScrollTranscriptEnabled && mainContentAreaEl) {
                let scrollTargetY = paragraphContainer.offsetTop - mainContentAreaEl.offsetTop - (mainContentAreaEl.clientHeight * 0.2);
                mainContentAreaEl.scrollTo({ top: Math.max(0, scrollTargetY), behavior: "smooth" });
            }
        }
        
        currentActiveParagraphContainer = paragraphContainer;
    }
}

function updateActiveSentence(sentenceEl, shouldScroll = false) {
    if (currentActiveSentence !== sentenceEl) {
        if (currentActiveSentence) {
            currentActiveSentence.classList.remove('highlighted-sentence');
        }
        
        if (sentenceEl) {
            sentenceEl.classList.add('highlighted-sentence');
            
            // Fine-tune scroll for sentence if paragraph is already active
            if (shouldScroll && autoScrollTranscriptEnabled && mainContentAreaEl && 
                currentActiveParagraphContainer && currentActiveParagraphContainer.classList.contains('active')) {
                const sRect = sentenceEl.getBoundingClientRect();
                const mainContentRect = mainContentAreaEl.getBoundingClientRect();
                
                // Ensure sentence is visible
                if (sRect.top < mainContentRect.top + 20 || sRect.bottom > mainContentRect.bottom - 20) {
                    let sentScrollOffset = sentenceEl.offsetTop - mainContentAreaEl.offsetTop - (mainContentAreaEl.clientHeight / 2) + (sentenceEl.offsetHeight / 2);
                    mainContentAreaEl.scrollTo({ top: Math.max(0, sentScrollOffset), behavior: "smooth" });
                }
            }
        }
        
        currentActiveSentence = sentenceEl;
    }
}

function updateHighlightsBasedOnVideoTime() {
    if (!player || typeof player.getCurrentTime !== 'function' || allParagraphsData.length === 0) return;
    
    const currentTime = player.getCurrentTime();
    let activeParagraphData = null, activeSentenceData = null;
    
    // Find the active paragraph
    for (const para of allParagraphsData) {
        if (currentTime >= para.start && currentTime < para.end) {
            activeParagraphData = para;
            break;
        }
    }
    
    // If no exact match, find the last paragraph that started
    if (!activeParagraphData) {
        for (let i = allParagraphsData.length - 1; i >= 0; i--) {
            if (currentTime >= allParagraphsData[i].start) {
                activeParagraphData = allParagraphsData[i];
                break;
            }
        }
    }
    
    if (activeParagraphData) {
        const paragraphContainer = document.querySelector(`.paragraph-container[data-paragraph-id="${activeParagraphData.id}"]`);
        updateActiveParagraph(paragraphContainer, autoScrollTranscriptEnabled);
        
        // Find active sentence within the paragraph
        for (const sent of activeParagraphData.sentences) {
            if (currentTime >= sent.start && currentTime < sent.end) {
                activeSentenceData = sent;
                break;
            }
        }
        
        // If no exact match, find the last sentence that started
        if (!activeSentenceData && activeParagraphData.sentences.length > 0) {
            for (let i = activeParagraphData.sentences.length - 1; i >= 0; i--) {
                if (currentTime >= activeParagraphData.sentences[i].start) {
                    activeSentenceData = activeParagraphData.sentences[i];
                    break;
                }
            }
        }
        
        if (activeSentenceData) {
            const sentenceEl = document.getElementById(activeSentenceData.id);
            updateActiveSentence(sentenceEl, autoScrollTranscriptEnabled);
        }
    } else {
        // No active paragraph found
        updateActiveParagraph(null);
        updateActiveSentence(null);
    }
}

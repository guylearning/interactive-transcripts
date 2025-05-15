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
            setupTimelineInteractions();
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
            document.querySelector('.video-section').classList.add('minimal-mode');
            minimalVideoToggle.checked = true;
        }
        minimalVideoToggle.addEventListener('change', function() {
            if (this.checked) {
                document.querySelector('.video-section').classList.add('minimal-mode');
                localStorage.setItem('videoMinimalMode', 'true');
            } else {
                document.querySelector('.video-section').classList.remove('minimal-mode');
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

function setupTimelineInteractions() {
    if (!mainContentAreaEl) return;
    
    // Set up click handlers for timeline dots
    const timelineDots = document.querySelectorAll('.timeline-dot');
    timelineDots.forEach(dot => {
        dot.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent triggering paragraph click
            const timestamp = parseFloat(this.getAttribute('data-timestamp'));
            if (player && player.seekTo) {
                player.seekTo(timestamp, true);
                if (player.getPlayerState() !== YT.PlayerState.PLAYING) player.playVideo();
            }
        });
    });
    
    // Set up click handlers for individual sentences
    const sentenceElements = document.querySelectorAll('.transcript-sentence');
    sentenceElements.forEach(sentence => {
        sentence.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent triggering paragraph click
            const startTime = parseFloat(this.getAttribute('data-start-time'));
            if (player && player.seekTo) {
                player.seekTo(startTime, true);
                if (player.getPlayerState() !== YT.PlayerState.PLAYING) player.playVideo();
            }
        });
    });
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
    if (currentActiveParagraphContainer === paragraphContainer) return;
    
    // Remove active class from previous paragraph
    if (currentActiveParagraphContainer) {
        currentActiveParagraphContainer.classList.remove('paragraph-active');
    }
    
    // Add active class to new paragraph
    if (paragraphContainer) {
        paragraphContainer.classList.add('paragraph-active');
        
        // Scroll to paragraph if needed
        if (shouldScroll && autoScrollTranscriptEnabled) {
            const transcriptColumn = document.querySelector('.transcript-column');
            if (transcriptColumn) {
                const paragraphTop = paragraphContainer.offsetTop;
                const viewportHeight = transcriptColumn.clientHeight;
                const scrollTop = transcriptColumn.scrollTop;
                
                // Only scroll if the paragraph is not already visible
                if (paragraphTop < scrollTop || paragraphTop > scrollTop + viewportHeight - 100) {
                    transcriptColumn.scrollTo({
                        top: paragraphTop - 100,
                        behavior: 'smooth'
                    });
                }
            }
        }
    }
    
    currentActiveParagraphContainer = paragraphContainer;
}

function updateActiveSentence(sentenceEl, shouldScroll = false) {
    if (currentActiveSentence === sentenceEl) return;
    
    // Remove active class from previous sentence
    if (currentActiveSentence) {
        currentActiveSentence.classList.remove('sentence-active');
    }
    
    // Add active class to new sentence
    if (sentenceEl) {
        sentenceEl.classList.add('sentence-active');
    }
    
    currentActiveSentence = sentenceEl;
}

function updateHighlightsBasedOnVideoTime() {
    if (!player || typeof player.getCurrentTime !== 'function' || allParagraphsData.length === 0) return;
    
    const currentTime = player.getCurrentTime();
    let activeParagraphData = null, activeSentenceData = null;
    
    // Find the active paragraph
    for (const para of allParagraphsData) {
        if (currentTime >= para.start && currentTime <= para.end) {
            activeParagraphData = para;
            
            // Find active sentence within paragraph
            for (const sentence of para.sentences) {
                if (currentTime >= sentence.start && currentTime <= sentence.end) {
                    activeSentenceData = sentence;
                    break;
                }
            }
            
            // If no exact match for sentence, use the first sentence
            if (!activeSentenceData && para.sentences.length > 0) {
                activeSentenceData = para.sentences[0];
            }
            
            break;
        }
    }
    
    // If no exact match, find the closest paragraph
    if (!activeParagraphData && allParagraphsData.length > 0) {
        let closestParagraph = allParagraphsData[0];
        let minDistance = Math.abs(currentTime - closestParagraph.start);
        
        for (let i = 1; i < allParagraphsData.length; i++) {
            const distance = Math.abs(currentTime - allParagraphsData[i].start);
            if (distance < minDistance) {
                minDistance = distance;
                closestParagraph = allParagraphsData[i];
            }
        }
        
        if (currentTime >= closestParagraph.start) {
            activeParagraphData = closestParagraph;
            
            // Use the last sentence of the paragraph if past its end
            if (closestParagraph.sentences.length > 0) {
                activeSentenceData = closestParagraph.sentences[closestParagraph.sentences.length - 1];
            }
        }
    }
    
    // Update the UI
    if (activeParagraphData) {
        const paragraphContainer = document.querySelector(`.paragraph-container[data-paragraph-id="${activeParagraphData.id}"]`);
        updateActiveParagraph(paragraphContainer, true);
        
        if (activeSentenceData) {
            const sentenceEl = document.getElementById(activeSentenceData.id);
            updateActiveSentence(sentenceEl, true);
        }
    } else {
        updateActiveParagraph(null);
        updateActiveSentence(null);
    }
} 

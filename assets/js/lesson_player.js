// assets/js/lesson_player.js
var player;
var allParagraphsData = [];
var autoScrollTranscriptEnabled = true;

var currentActiveTimelineItem = null;
var currentActiveParagraphText = null;
var currentActiveSentence = null;

var mainContentAreaEl; // This is now the primary scroll container
var paragraphObserver, videoTimeUpdaterInterval;

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
        try { allParagraphsData = JSON.parse(transcriptDataElem.textContent); }
        catch (e) { console.error("Parse allTranscriptData failed:", e);
            const tcEl = document.getElementById('transcript-content-container');
            if(tcEl) tcEl.innerHTML = "<p class='no-transcript-message'>Error loading transcript.</p>"; return; 
        }
    }
    if (allParagraphsData.length === 0) {
        const tcEl = document.getElementById('transcript-content-container');
        if(tcEl && !tcEl.querySelector('.no-transcript-message')) { // Avoid duplicate messages
             tcEl.innerHTML = "<p class='no-transcript-message'>No transcript data found.</p>";
        }
    }

    setupClickHandlers();
    setupScrollAndVideoSync();

    const autoScrollCheckbox = document.getElementById('autoScrollTranscriptCheckbox');
    if (autoScrollCheckbox) {
        autoScrollTranscriptEnabled = autoScrollCheckbox.checked;
        autoScrollCheckbox.addEventListener('change', function() { autoScrollTranscriptEnabled = this.checked; });
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

function setupClickHandlers() {
    document.querySelectorAll('.timeline-item').forEach(item => {
        item.addEventListener('click', () => {
            const startTime = parseFloat(item.dataset.startTime);
            const targetTranscriptId = item.dataset.targetTranscriptId;
            const targetElement = document.getElementById(targetTranscriptId);
            
            if (targetElement && mainContentAreaEl) {
                let scrollTargetY = targetElement.offsetTop - mainContentAreaEl.offsetTop - (mainContentAreaEl.clientHeight * 0.1);
                mainContentAreaEl.scrollTo({ top: Math.max(0, scrollTargetY), behavior: "smooth" });
            }
            if (player && player.seekTo) { player.seekTo(startTime, true); if (player.getPlayerState() !== YT.PlayerState.PLAYING) player.playVideo(); }
        });
    });
    document.querySelectorAll('.transcript-sentence').forEach(sentEl => {
        sentEl.addEventListener('click', () => {
            const startTime = parseFloat(sentEl.dataset.startTime);
            if (player && player.seekTo) { player.seekTo(startTime, true); if (player.getPlayerState() !== YT.PlayerState.PLAYING) player.playVideo(); }
        });
    });
}

function setupScrollAndVideoSync() {
    if (mainContentAreaEl && typeof IntersectionObserver !== 'undefined') {
        const observerOptions = {
            root: mainContentAreaEl, 
            rootMargin: "-25% 0px -65% 0px", // Adjust to pick paragraph closer to top
            threshold: 0.01 
        };
        paragraphObserver = new IntersectionObserver((entries) => {
            if (player && player.getPlayerState() === YT.PlayerState.PLAYING && autoScrollTranscriptEnabled) return;

            let topmostEntry = null;
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    if (!topmostEntry || entry.boundingClientRect.top < topmostEntry.boundingClientRect.top) {
                        topmostEntry = entry;
                    }
                }
            }
            if (topmostEntry) {
                const paragraphIdx = parseInt(topmostEntry.target.dataset.paragraphIdx, 10);
                updateActiveStates(paragraphIdx, null, false); 
            }
        }, observerOptions);
        document.querySelectorAll('.transcript-paragraph-text').forEach(p => paragraphObserver.observe(p));
    }
    startVideoTimeUpdater(); 
}
        
function onPlayerStateChange(event) { 
    if (event.data === YT.PlayerState.PLAYING) startVideoTimeUpdater(); 
    else stopVideoTimeUpdater(); 
}
function startVideoTimeUpdater() { if (videoTimeUpdaterInterval) clearInterval(videoTimeUpdaterInterval); videoTimeUpdaterInterval = setInterval(updateHighlightsAndScrollsBasedOnVideoTime, 180); } // Slightly adjusted interval
function stopVideoTimeUpdater() { clearInterval(videoTimeUpdaterInterval); }

function updateActiveStates(activeParagraphIndex, activeSentenceId, scrollMainContentIfNeeded) {
    const targetTimelineItem = document.querySelector(`.timeline-item[data-paragraph-idx='${activeParagraphIndex}']`);
    if (currentActiveTimelineItem !== targetTimelineItem) {
        if (currentActiveTimelineItem) currentActiveTimelineItem.classList.remove('active');
        if (targetTimelineItem) targetTimelineItem.classList.add('active');
        currentActiveTimelineItem = targetTimelineItem;
    }

    const targetParagraphText = document.querySelector(`.transcript-paragraph-text[data-paragraph-idx='${activeParagraphIndex}']`);
    if (currentActiveParagraphText !== targetParagraphText) {
        if (currentActiveParagraphText) currentActiveParagraphText.classList.remove('highlighted-paragraph');
        if (targetParagraphText) {
            targetParagraphText.classList.add('highlighted-paragraph');
            if (scrollMainContentIfNeeded && autoScrollTranscriptEnabled && mainContentAreaEl) {
                 let scrollTargetY = targetParagraphText.offsetTop - mainContentAreaEl.offsetTop - (mainContentAreaEl.clientHeight * 0.1); // Aim for top 10%
                 mainContentAreaEl.scrollTo({ top: Math.max(0, scrollTargetY), behavior: "smooth" });
            }
        }
        currentActiveParagraphText = targetParagraphText;
    }

    const sentenceEl = activeSentenceId ? document.getElementById(activeSentenceId) : null;
    if (currentActiveSentence !== sentenceEl) {
        if (currentActiveSentence) currentActiveSentence.classList.remove('highlighted-sentence');
        if (sentenceEl) {
            sentenceEl.classList.add('highlighted-sentence');
            if (scrollMainContentIfNeeded && autoScrollTranscriptEnabled && mainContentAreaEl && targetParagraphText && targetParagraphText.classList.contains('highlighted-paragraph')) {
                // Check if sentence is out of view *within* the mainContentAreaEl viewport
                const sR = sentenceEl.getBoundingClientRect();
                const mainContentRect = mainContentAreaEl.getBoundingClientRect(); 
                // Ensure sentence is visible, or scroll to make it so
                if (sR.top < mainContentRect.top + 20 || sR.bottom > mainContentRect.bottom - 20) {
                    let sentScrollOffset = sentenceEl.offsetTop - mainContentAreaEl.offsetTop - (mainContentAreaEl.clientHeight / 2) + (sentenceEl.offsetHeight / 2);
                    mainContentAreaEl.scrollTo({ top: Math.max(0, sentScrollOffset), behavior: "smooth" });
                }
            }
        }
        currentActiveSentence = sentenceEl;
    }
}

function updateHighlightsAndScrollsBasedOnVideoTime() {
    if (!player || typeof player.getCurrentTime !== 'function' || allParagraphsData.length === 0) return;
    const currentTime = player.getCurrentTime();
    let activeParagraphData = null, activeSentenceData = null;

    for (const para of allParagraphsData) { if (currentTime >= para.start && currentTime < para.end) { activeParagraphData = para; break; } }
    if (!activeParagraphData) { for (let i = allParagraphsData.length - 1; i >= 0; i--) { if (currentTime >= allParagraphsData[i].start) { activeParagraphData = allParagraphsData[i]; break; } } }
    
    if (activeParagraphData) {
        let shouldScrollMain = autoScrollTranscriptEnabled;
        // Only trigger a main scroll if the *paragraph* itself has changed
        // and auto-scroll is on. Sentence changes within the same paragraph shouldn't re-scroll the whole paragraph.
        if (currentActiveParagraphText && currentActiveParagraphText.id === `text-${activeParagraphData.id}`) {
            shouldScrollMain = false; // Already on this paragraph, let sentence scroll handle fine-tuning
        }
        
        updateActiveStates(activeParagraphData.paragraph_idx, null, shouldScrollMain); // Update paragraph and timeline first

        // Now find and update sentence within the (now potentially scrolled to) active paragraph
        const paragraphTextEl = document.getElementById(`text-${activeParagraphData.id}`); // Re-fetch in case DOM changed
        if (paragraphTextEl) { // Check if paragraphTextEl is valid
            for (const sent of activeParagraphData.sentences) { if (currentTime >= sent.start && currentTime < sent.end) { activeSentenceData = sent; break; } }
            if (!activeSentenceData) { for (let i = activeParagraphData.sentences.length - 1; i >= 0; i--) { if (currentTime >= activeParagraphData.sentences[i].start) { activeSentenceData = activeParagraphData.sentences[i]; break; } } }
            
            // Call updateActiveStates again, but only to update the sentence and potentially fine-tune scroll for sentence
            updateActiveStates(activeParagraphData.paragraph_idx, activeSentenceData ? activeSentenceData.id : null, autoScrollTranscriptEnabled); 
        }

    } else { // No active paragraph
        if (currentActiveTimelineItem) currentActiveTimelineItem.classList.remove('active');
        if (currentActiveParagraphText) currentActiveParagraphText.classList.remove('highlighted-paragraph');
        if (currentActiveSentence) currentActiveSentence.classList.remove('highlighted-sentence');
        currentActiveTimelineItem = null; currentActiveParagraphText = null; currentActiveSentence = null;
    }
}

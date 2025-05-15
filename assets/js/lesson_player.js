// assets/js/lesson_player.js
var player;
var allParagraphsData = [];
var autoScrollTranscriptEnabled = true;
// var autoScrollTimelineEnabled = true; // Removed

var currentActiveTimelineItem = null;
var currentActiveParagraphText = null;
var currentActiveSentence = null;

var mainContentAreaEl, transcriptContentEl, timelineContainerEl; // Added mainContentAreaEl
var paragraphObserver, videoTimeUpdaterInterval;

// YouTube IFrame API loader
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
        return;
    }
    player = new YT.Player('youtube-player-iframe', {
        videoId: window.YT_VIDEO_ID,
        playerVars: { 'playsinline': 1, 'rel': 0, 'modestbranding': 1, 'origin': window.location.origin },
        events: { 'onReady': onPlayerReady, 'onStateChange': onPlayerStateChange }
    });
}

function onPlayerReady(event) {
    mainContentAreaEl = document.getElementById('mainContentArea'); // Main scrollable area
    transcriptContentEl = document.getElementById('transcript-content-container');
    timelineContainerEl = document.getElementById('timeline-container'); 
    
    const transcriptDataElem = document.getElementById('allTranscriptData');
    if (transcriptDataElem && transcriptDataElem.textContent) {
        try { allParagraphsData = JSON.parse(transcriptDataElem.textContent); }
        catch (e) { console.error("Parse allTranscriptData failed:", e); if(transcriptContentEl) transcriptContentEl.innerHTML = "<p class='no-transcript-message'>Error loading transcript.</p>"; return; }
    }
    if (allParagraphsData.length === 0 && transcriptContentEl && transcriptContentEl.querySelector('.no-transcript-message')) {/*Msg already shown*/}

    setupClickHandlers();
    setupScrollAndVideoSync(); // Combined observer and video time updater logic

    const autoScrollCheckbox = document.getElementById('autoScrollTranscriptCheckbox');
    if (autoScrollCheckbox) {
        autoScrollTranscriptEnabled = autoScrollCheckbox.checked;
        autoScrollCheckbox.addEventListener('change', function() { autoScrollTranscriptEnabled = this.checked; });
    }

    const minimalModeToggle = document.getElementById('minimalVideoToggle'); // Assuming you add this ID
    if (minimalModeToggle) {
        // Check localStorage for saved preference
        if (localStorage.getItem('videoMinimalMode') === 'true') {
            document.body.classList.add('video-minimal-mode');
            minimalModeToggle.checked = true;
        }
        minimalModeToggle.addEventListener('change', function() {
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
            const targetId = item.dataset.targetTranscriptId; // Use new data attribute
            const targetElement = document.getElementById(targetId);
            
            if (targetElement && mainContentAreaEl) { // Scroll main content area
                // Calculate offset to bring the paragraph to a good position within the main scroll area
                let scrollOffset = targetElement.offsetTop - mainContentAreaEl.offsetTop - (mainContentAreaEl.clientHeight * 0.1); // 10% from top
                mainContentAreaEl.scrollTo({ top: Math.max(0, scrollOffset), behavior: "smooth" });
            }
            if (player && player.seekTo) { player.seekTo(startTime, true); if (player.getPlayerState() !== 1) player.playVideo(); }
        });
    });
    document.querySelectorAll('.transcript-sentence').forEach(sentEl => {
        sentEl.addEventListener('click', () => {
            const startTime = parseFloat(sentEl.dataset.startTime);
            if (player && player.seekTo) { player.seekTo(startTime, true); if (player.getPlayerState() !== 1) player.playVideo(); }
        });
    });
}

function setupScrollAndVideoSync() {
    // Observer for when user scrolls transcript manually (video paused)
    if (mainContentAreaEl && typeof IntersectionObserver !== 'undefined') {
        const observerOptions = {
            root: mainContentAreaEl, // Observe within the main scrollable area
            rootMargin: "-30% 0px -60% 0px", // Activate when paragraph is near top 1/3
            threshold: 0.01
        };
        paragraphObserver = new IntersectionObserver((entries) => {
            if (player && player.getPlayerState() === YT.PlayerState.PLAYING) return;

            let topmostIntersectingEntry = null;
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    if (!topmostIntersectingEntry || entry.boundingClientRect.top < topmostIntersectingEntry.boundingClientRect.top) {
                        topmostIntersectingEntry = entry;
                    }
                }
            }
            if (topmostIntersectingEntry) {
                const paragraphIdx = topmostIntersectingEntry.target.dataset.paragraphIdx;
                highlightBasedOnParagraphIndex(paragraphIdx, false); // scrollTimeline = false
            }
        }, observerOptions);
        document.querySelectorAll('.transcript-paragraph-text').forEach(p => paragraphObserver.observe(p));
    }
    // Interval for when video is playing
    startVideoTimeUpdater(); // Start it initially, onPlayerStateChange will manage it
}
        
function onPlayerStateChange(event) { 
    if (event.data === YT.PlayerState.PLAYING) startVideoTimeUpdater(); 
    else stopVideoTimeUpdater(); 
}
function startVideoTimeUpdater() { if (videoTimeUpdaterInterval) clearInterval(videoTimeUpdaterInterval); videoTimeUpdaterInterval = setInterval(updateHighlightsAndScrollsBasedOnVideoTime, 150); }
function stopVideoTimeUpdater() { clearInterval(videoTimeUpdaterInterval); }

function highlightBasedOnParagraphIndex(paragraphIdx, scrollMainContentIfNeeded) {
    const targetTimelineItem = document.querySelector(`.timeline-item[data-paragraph-idx='${paragraphIdx}']`);
    const targetParagraphText = document.querySelector(`.transcript-paragraph-text[data-paragraph-idx='${paragraphIdx}']`);

    if (currentActiveTimelineItem !== targetTimelineItem) {
        if (currentActiveTimelineItem) currentActiveTimelineItem.classList.remove('active');
        if (targetTimelineItem) targetTimelineItem.classList.add('active');
        currentActiveTimelineItem = targetTimelineItem;
    }
    if (currentActiveParagraphText !== targetParagraphText) {
        if (currentActiveParagraphText) currentActiveParagraphText.classList.remove('highlighted-paragraph');
        if (targetParagraphText) {
            targetParagraphText.classList.add('highlighted-paragraph');
            if (scrollMainContentIfNeeded && autoScrollTranscriptEnabled && mainContentAreaEl) {
                 // Calculate offset to bring the paragraph to a good position within the main scroll area
                let scrollOffset = targetParagraphText.offsetTop - mainContentAreaEl.offsetTop - (mainContentAreaEl.clientHeight * 0.1); // 10% from top
                mainContentAreaEl.scrollTo({ top: Math.max(0, scrollOffset), behavior: "smooth" });
            }
        }
        currentActiveParagraphText = targetParagraphText;
    }
}

function updateHighlightsAndScrollsBasedOnVideoTime() {
    if (!player || typeof player.getCurrentTime !== 'function' || allParagraphsData.length === 0) return;
    const currentTime = player.getCurrentTime();
    let activeParagraphData = null, activeSentenceData = null;

    for (const para of allParagraphsData) { if (currentTime >= para.start && currentTime < para.end) { activeParagraphData = para; break; } }
    if (!activeParagraphData) { for (let i = allParagraphsData.length - 1; i >= 0; i--) { if (currentTime >= allParagraphsData[i].start) { activeParagraphData = allParagraphsData[i]; break; } } }
    
    if (activeParagraphData) {
        highlightBasedOnParagraphIndex(activeParagraphData.paragraph_idx, true); // scrollMainContentIfNeeded = true

        const paragraphTextEl = currentActiveParagraphText; // Already set by highlightBasedOnParagraphIndex
        if (paragraphTextEl) {
            for (const sent of activeParagraphData.sentences) { if (currentTime >= sent.start && currentTime < sent.end) { activeSentenceData = sent; break; } }
            if (!activeSentenceData) { for (let i = activeParagraphData.sentences.length - 1; i >= 0; i--) { if (currentTime >= activeParagraphData.sentences[i].start) { activeSentenceData = activeParagraphData.sentences[i]; break; } } }
            
            const sentenceEl = activeSentenceData ? document.getElementById(activeSentenceData.id) : null;
            if (currentActiveSentence !== sentenceEl) {
                if (currentActiveSentence) currentActiveSentence.classList.remove('highlighted-sentence');
                if (sentenceEl) { 
                    sentenceEl.classList.add('highlighted-sentence'); 
                    if (autoScrollTranscriptEnabled && mainContentAreaEl && paragraphTextEl.classList.contains('highlighted-paragraph')) {
                        // Check if sentence is out of view within the main content area
                        const sR = sentenceEl.getBoundingClientRect(), cR_main = mainContentAreaEl.getBoundingClientRect();
                        if(sR.top < cR_main.top + (mainContentAreaEl.clientHeight*0.1) || sR.bottom > cR_main.bottom - (mainContentAreaEl.clientHeight*0.1) ) {
                             // sentenceEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                             // More controlled scroll:
                             let sentScrollOffset = sentenceEl.offsetTop - mainContentAreaEl.offsetTop - (mainContentAreaEl.clientHeight / 2) + (sentenceEl.clientHeight / 2) ;
                             mainContentAreaEl.scrollTo({ top: Math.max(0, sentScrollOffset), behavior: "smooth" });
                        }
                    }
                }
                currentActiveSentence = sentenceEl;
            }
        }
    } else {
        if (currentActiveTimelineItem) currentActiveTimelineItem.classList.remove('active');
        if (currentActiveParagraphText) currentActiveParagraphText.classList.remove('highlighted-paragraph');
        if (currentActiveSentence) currentActiveSentence.classList.remove('highlighted-sentence');
        currentActiveTimelineItem = null; currentActiveParagraphText = null; currentActiveSentence = null;
    }
}
// scrollToViewIfNeeded is now part of the main logic, so not needed as a separate general helper
// if needed, it would be:
// function scrollToViewIfNeeded(element, container, blockPosition = 'nearest', offset = 0) {
//     if (!element || !container) return;
//     const elemRect = element.getBoundingClientRect();
//     const containerRect = container.getBoundingClientRect();
//     const isOutOfView = elemRect.top < containerRect.top + offset || elemRect.bottom > containerRect.bottom - offset;
//     if (isOutOfView) element.scrollIntoView({ behavior: 'smooth', block: blockPosition });
// }

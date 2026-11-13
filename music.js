"use strict";

const musicButton = document.querySelector("#music-toggle");
const musicPanel = document.querySelector("#music-panel");
const musicStatus = document.querySelector("#music-status");
const musicMount = document.querySelector("#music-mount");
const musicVideoId = "KRtvCCDbLgQ";
let musicPlayer = null;
let musicReady = false;
let musicWanted = false;
let musicLoading = false;
let musicWatchdog = null;
let musicScript = null;

function musicFailure(message) {
  clearTimeout(musicWatchdog);
  musicWanted = false;
  musicLoading = false;
  musicReady = false;
  musicButton.disabled = false;
  musicButton.textContent = "음악 다시 시도";
  musicButton.setAttribute("aria-pressed", "false");
  musicStatus.textContent = message;
}

function createMusicPlayer() {
  if (!musicLoading || musicPlayer) return;
  musicPlayer = new YT.Player("music-player", {
    width: "320",
    height: "200",
    videoId: musicVideoId,
    playerVars: {
      autoplay: 1,
      loop: 1,
      playlist: musicVideoId,
      playsinline: 1,
      controls: 1,
      origin: window.location.origin,
    },
    events: {
      onReady(event) {
        clearTimeout(musicWatchdog);
        musicLoading = false;
        musicReady = true;
        musicButton.disabled = false;
        const frame = event.target.getIframe();
        frame.title = "YouTube 음악 반복 재생";
        frame.setAttribute("allow", "autoplay; encrypted-media; fullscreen; picture-in-picture");
        frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
        event.target.setVolume(40);
        musicButton.textContent = "음악 재생";
        musicStatus.textContent = "재생을 준비했어요.";
        if (musicWanted) event.target.playVideo();
      },
      onStateChange(event) {
        if (event.data === YT.PlayerState.PLAYING) {
          musicWanted = true;
          musicButton.textContent = "음악 일시정지";
          musicButton.setAttribute("aria-pressed", "true");
          musicStatus.textContent = "한 곡 반복 재생 중";
        } else if (event.data === YT.PlayerState.PAUSED) {
          musicWanted = false;
          musicButton.textContent = "음악 재생";
          musicButton.setAttribute("aria-pressed", "false");
          musicStatus.textContent = "음악 일시정지";
        } else if (event.data === YT.PlayerState.ENDED && musicWanted) {
          event.target.seekTo(0, true);
          event.target.playVideo();
        }
      },
      onAutoplayBlocked() {
        musicWanted = false;
        musicButton.textContent = "음악 재생";
        musicButton.setAttribute("aria-pressed", "false");
        musicStatus.textContent = "음악 재생 버튼을 눌러 소리를 켜 주세요.";
      },
      onError(event) {
        const messages = {
          100: "유튜브에서 이 곡을 불러올 수 없어요.",
          101: "이 곡의 사이트 내 재생이 제한되어 있어요.",
          150: "이 곡의 사이트 내 재생이 제한되어 있어요.",
          153: "유튜브가 사이트 주소를 확인하지 못했어요. 배포한 사이트에서 다시 열어 주세요.",
        };
        musicFailure(messages[event.data] || "음악을 재생하지 못했어요. 아래 링크에서 곡을 확인할 수 있어요.");
      },
    },
  });
}

musicButton.addEventListener("click", () => {
  musicPanel.hidden = false;
  document.body.classList.add("music-open");
  if (!["http:", "https:"].includes(window.location.protocol)) {
    musicFailure("음악은 웹 주소로 연 페이지에서 재생할 수 있어요. 배포된 사이트나 http://localhost:8000에서 열어 주세요.");
    return;
  }
  if (musicLoading) return;
  if (musicReady) {
    const state = musicPlayer.getPlayerState();
    musicWanted = state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING;
    if (musicWanted) musicPlayer.playVideo();
    else musicPlayer.pauseVideo();
    return;
  }

  if (musicPlayer) musicPlayer.destroy();
  musicPlayer = null;
  const placeholder = document.createElement("div");
  placeholder.id = "music-player";
  musicMount.replaceChildren(placeholder);
  musicWanted = true;
  musicLoading = true;
  musicButton.disabled = true;
  musicButton.textContent = "음악 불러오는 중";
  musicStatus.textContent = "유튜브에 연결하고 있어요.";
  musicWatchdog = setTimeout(() => musicFailure("음악 연결이 지연되고 있어요. 다시 시도하거나 아래 링크에서 열어 주세요."), 20000);

  if (window.YT && typeof YT.Player === "function") {
    createMusicPlayer();
    return;
  }
  if (musicScript) musicScript.remove();
  window.onYouTubeIframeAPIReady = createMusicPlayer;
  musicScript = document.createElement("script");
  musicScript.src = "https://www.youtube.com/iframe_api";
  musicScript.async = true;
  musicScript.onerror = () => musicFailure("유튜브에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.");
  document.head.append(musicScript);
});


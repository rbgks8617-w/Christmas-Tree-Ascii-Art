"use strict";
const musicButton = document.querySelector("#music-toggle");
const musicPanel = document.querySelector("#music-panel");
const musicStatus = document.querySelector("#music-status");
const musicMount = document.querySelector("#music-mount");
const volumeInput = document.querySelector("#music-volume");
const volumeValue = document.querySelector("#volume-value");
const musicVideoId = "KRtvCCDbLgQ";
let musicPlayer = null, musicReady = false, musicLoading = false;
let musicWanted = true, needsGesture = false, musicWatchdog, musicScript;
let musicVolume = 40;
try {
  const saved = localStorage.getItem("tree-volume");
  if (saved !== null && Number.isFinite(Number(saved)))
    musicVolume = Math.max(0, Math.min(100, Number(saved)));
} catch (_) {}
function updateVolume() {
  volumeInput.value = musicVolume;
  volumeValue.textContent = musicVolume + "%";
  volumeInput.setAttribute("aria-valuetext", musicVolume + "%");
  if (musicReady) {
    musicPlayer.setVolume(musicVolume);
    if (musicVolume === 0) musicPlayer.mute();
    else musicPlayer.unMute();
  }
}
updateVolume();
volumeInput.addEventListener("input", () => {
  musicVolume = Number(volumeInput.value);
  updateVolume();
  try { localStorage.setItem("tree-volume", String(musicVolume)); } catch (_) {}
});
function musicFailure(message) {
  clearTimeout(musicWatchdog);
  musicLoading = musicReady = musicWanted = needsGesture = false;
  musicButton.disabled = false;
  musicButton.textContent = "음악 다시 시도";
  musicButton.setAttribute("aria-pressed", "false");
  musicStatus.textContent = message;
}
function playMusic() {
  if (!musicReady) return;
  musicWanted = true;
  needsGesture = false;
  updateVolume();
  musicPlayer.playVideo();
}
function createMusicPlayer() {
  if (!musicLoading || musicPlayer) return;
  musicPlayer = new YT.Player("music-player", {
    width: "320", height: "200", videoId: musicVideoId,
    playerVars: {autoplay: 1, loop: 1, playlist: musicVideoId, playsinline: 1,
      controls: 1, origin: window.location.origin},
    events: {
      onReady(event) {
        if (event.target !== musicPlayer || !musicLoading) return;
        clearTimeout(musicWatchdog);
        musicLoading = false; musicReady = true; musicButton.disabled = false;
        const frame = event.target.getIframe();
        frame.tabIndex = -1;
        frame.title = "음악";
        frame.setAttribute("allow", "autoplay; encrypted-media");
        frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
        updateVolume();
        if (musicWanted) playMusic();
      },
      onStateChange(event) {
        if (event.target !== musicPlayer || !musicReady) return;
        if (event.data === YT.PlayerState.PLAYING) {
          musicWanted = true; needsGesture = false;
          musicButton.textContent = "음악 끄기";
          musicButton.setAttribute("aria-pressed", "true");
          musicStatus.textContent = "";
        } else if (event.data === YT.PlayerState.PAUSED) {
          musicWanted = false;
          musicButton.textContent = "음악 켜기";
          musicButton.setAttribute("aria-pressed", "false");
        } else if (event.data === YT.PlayerState.ENDED && musicWanted) {
          event.target.seekTo(0, true); event.target.playVideo();
        }
      },
      onAutoplayBlocked() {
        needsGesture = true;
        musicButton.textContent = "음악 켜기";
        musicButton.setAttribute("aria-pressed", "false");
        musicStatus.textContent = "화면을 한 번 터치하면 음악이 시작돼요.";
      },
      onError(event) {
        if (event.target !== musicPlayer) return;
        const messages = {
          100: "이 곡을 불러올 수 없어요.",
          101: "이 곡은 YouTube에서 외부 사이트 재생을 허용하지 않아요.",
          150: "이 곡은 YouTube에서 외부 사이트 재생을 허용하지 않아요.",
          153: "음악 연결을 확인하지 못했어요. 사이트를 새로고침해 주세요."
        };
        musicFailure(messages[event.data] || "음악 연결에 실패했어요.");
      }
    }
  });
}
function loadMusic() {
  if (musicLoading) return;
  if (!["http:", "https:"].includes(window.location.protocol)) {
    musicFailure("웹사이트에서 음악을 재생할 수 있어요.");
    return;
  }
  musicPanel.hidden = false;
  if (musicPlayer) musicPlayer.destroy();
  musicPlayer = null;
  const placeholder = document.createElement("div");
  placeholder.id = "music-player"; musicMount.replaceChildren(placeholder);
  musicWanted = musicLoading = true; musicReady = needsGesture = false;
  musicButton.disabled = true; musicButton.textContent = "음악 연결 중";
  musicWatchdog = setTimeout(() => musicFailure("음악 연결이 지연되고 있어요."), 20000);
  if (window.YT && typeof YT.Player === "function") { createMusicPlayer(); return; }
  if (musicScript) musicScript.remove();
  window.onYouTubeIframeAPIReady = createMusicPlayer;
  musicScript = document.createElement("script");
  musicScript.src = "https://www.youtube.com/iframe_api"; musicScript.async = true;
  musicScript.onerror = () => musicFailure("음악 서버에 연결할 수 없어요.");
  document.head.append(musicScript);
}
musicButton.addEventListener("click", () => {
  if (!musicReady) { loadMusic(); return; }
  const state = musicPlayer.getPlayerState();
  if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING) {
    musicWanted = needsGesture = false; musicPlayer.pauseVideo();
  } else playMusic();
});
function resumeAfterGesture(event) {
  if (needsGesture && event.target !== musicButton) playMusic();
}
document.addEventListener("pointerdown", resumeAfterGesture);
document.addEventListener("keydown", resumeAfterGesture);
loadMusic();

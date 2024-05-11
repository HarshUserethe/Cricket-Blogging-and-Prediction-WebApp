var left = document.querySelector(".ri-arrow-left-s-line");
var right = document.querySelector(".ri-arrow-right-s-line");
var mainBody = document.querySelector(".main-body");

right.addEventListener("click", () => {
mainBody.scrollLeft += mainBody.offsetWidth;
})

left.addEventListener("click", () => {
mainBody.scrollLeft -= mainBody.offsetWidth;
})

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Function to hide the navigation div if the user is on iOS
function hideNavigationOnIOS() {
  if (isIOS()) {
    document.getElementById('navigationDiv').style.display = 'none';
  }
}

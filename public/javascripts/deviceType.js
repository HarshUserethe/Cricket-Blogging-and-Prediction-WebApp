var is_iOS = /(iPad|iPhone|iPod)/g.test(navigator.userAgent);
if (is_iOS) {
    document.querySelector('.navbar').style.position = 'relative';
    document.querySelector('.navbar').style.paddingTop = '12vw';
    document.querySelector('.heading').style.display = 'none';
    document.body.classList.add('ios-device');
}

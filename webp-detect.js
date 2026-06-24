/**
 * WebP Browser Support Detection
 * Adds 'webp' or 'no-webp' class to <html> element
 */
(function() {
    var html = document.documentElement;
    
    function addClass(cls) {
        html.classList.add(cls);
    }
    
    // Check WebP support
    var img = new Image();
    img.onload = function() {
        addClass('webp');
    };
    img.onerror = function() {
        addClass('no-webp');
    };
    img.src = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAQAAAAfQ//73v/+BiOh/AAA=';
})();

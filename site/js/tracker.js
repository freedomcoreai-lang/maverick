(function(){
    var d = {
        p: location.pathname,
        r: document.referrer || '',
        w: screen.width,
        t: document.title
    };
    var x = new XMLHttpRequest();
    x.open('POST', '/t/hit', true);
    x.setRequestHeader('Content-Type', 'application/json');
    x.send(JSON.stringify(d));
})();

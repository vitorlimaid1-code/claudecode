// Na exportação a página é impressa sem margens nem sombra
if (/print/.test(location.search)) document.body.classList.add('print');
window.setCoverZoom = z => { document.documentElement.style.zoom = z; };

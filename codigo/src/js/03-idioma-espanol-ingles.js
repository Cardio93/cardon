/* ======================= Idioma (español / inglés) =======================
   La interfaz se escribe en español; en inglés se traduce al vuelo con el diccionario EN.
   Claves con {} son patrones: «Paso {} de {}» → «Step {} of {}» ({0}, {1}… para reordenar). */
const I18N = { lang: 'es' };
try { if (localStorage.getItem('cardon.lang') === 'en') I18N.lang = 'en'; } catch (e) {}
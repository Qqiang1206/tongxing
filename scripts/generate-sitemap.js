/** Generate sitemap.xml using the same implementation as admin catalog writes. */
(async function () {
  try {
    const { generateSitemap } = await import('../server/src/services/sitemap.js');
    const result = generateSitemap();
    console.log(`Wrote ${result.path} (${result.count} urls)`);
  } catch (error) {
    console.error(`Sitemap generation failed: ${error.message}`);
    process.exitCode = 1;
  }
})();
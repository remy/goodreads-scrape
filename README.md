# Goodreads Scrape usage

This script can either be run directly in the browser OR as a node script.

If using node, it requires a single dependency: `cheerio` (`npm install cheerio`).

To run in the browser, copy the contents of this file and paste it into the console of the the Goodreads shelf page (signed in) and it will automatically run and output the JSON to the console. Copy that JSON and paste it into your own code and process the JSON as you wish.

To run as a node script, you need to set the env variable GOODREADS_SESSION via the command line: `GOODREADS_SESSION=... node goodreads-scrape.js` and the JSON will be output to the console.

To get the GOODREADS_SESSION, you need to sign into Goodreads, open the developer tools, and copy the value of the `document.cookie`. You can run this code in the console to get the value: `copy(document.cookie)`.

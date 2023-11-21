/**
 * Usage:
 *
 * This script can either be run directly in the browser OR as a node script.
 *
 * If using node, it requires a single dependency: `cheerio`.
 *
 * To run in the browser, copy the contents of this file and paste it into the
 * console of the the Goodreads shelf page (signed in) and it will automatically
 * run and output the JSON to the console. Copy that JSON and paste it into your
 * own code and process the JSON as you wish.
 *
 * To run as a node script, you need to set the env variable GOODREADS_SESSION
 * via the command line: `GOODREADS_SESSION=... node goodreads-scrape.js` and
 * the JSON will be output to the console.
 *
 * To get the GOODREADS_SESSION, you need to sign into Goodreads, open the
 * developer tools, and copy the value of the `document.cookie`. You can run
 * this code in the console to get the value: `copy(document.cookie)`.
 */

if (typeof window !== 'undefined') {
  /* eslint-env browser */

  // Create an invisible iframe to restore the original Array
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  // Use the Array.prototype.map from the iframe
  const Array = iframe.contentWindow.Array;
  document.body.removeChild(iframe);

  const map = Array.prototype.map;

  class NodeListArray extends Array {
    map(fn) {
      // one of jQuery's mistakes
      return NodeListArray.from(map.call(this, (v, i) => fn(i, v)));
    }
    find(s) {
      const res = map.call(this, (el) => el.querySelector(s)).filter(Boolean);
      return NodeListArray.from(res);
    }
    text() {
      if (this.length > 1) {
        return map.call(this, (el) => el.textContent);
      }

      if (this.length === 0) {
        return '';
      }

      return this[0].textContent;
    }
    html() {
      if (this.length > 1) {
        return map.call(this, (el) => el.innerHTML);
      }

      if (this.length === 0) {
        return '';
      }

      return this[0].innerHTML;
    }
    attr(prop) {
      if (this.length > 1) {
        return map.call(this, (el) => el.getAttribute(prop));
      }

      if (this.length === 0) {
        return '';
      }

      return this[0].getAttribute(prop);
    }
    get() {
      return Array.from(this);
    }
  }
  globalThis.cheerio = {
    load() {
      return (s) => {
        if (typeof s === 'string') {
          const el = document.querySelectorAll(s);

          return NodeListArray.from(el);
        }
        return NodeListArray.from([s]);
      };
    },
  };

  parseBooks();
} else {
  globalThis.cheerio = require('cheerio');

  // recommended url (with your own username)
  // https://www.goodreads.com/review/list/63680802-remy-sharp?utf8=%E2%9C%93&title=remy-sharp&per_page=100&shelf=read&page=1

  if (!process.env.GOODREADS_SESSION) {
    throw new Error(
      'You need to set the env variable GOODREADS_SESSION otherwise the data is not fully available'
    );
  }

  fetch(process.argv[2], {
    headers: {
      Cookie: process.env.GOODREADS_SESSION,
    },
  })
    .then((res) => res.text())
    .then((body) => {
      console.log(JSON.stringify(parseBooks(body)));
    });
}

/**
 * @param {string} body the html for the page
 * @returns {Goodreads[]}
 */
function parseBooks(body) {
  const correctedDate = (date) => {
    let d = new Date(date.trim() + ', Z');

    if (isNaN(d)) {
      // first try with a different format becase Date parsing is different
      // between browsers…
      d = new Date(date.trim() + ', +0');

      if (isNaN(d)) {
        return { toJSON: () => '?' }; // or any other default value
      }
    }

    return d;
  };

  const slug = (s) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-$/, '');

  const cheerio = globalThis.cheerio;

  const $ = cheerio.load(body);

  const res = $('.bookalike')
    .map((i, tr) => {
      const el = $(tr);
      const get = (s) =>
        el
          .find(s.includes(' ') ? s : `.${s} .value`)
          .text()
          .trim()
          .replace(/[\s\n]+/g, ' ');

      const goodreads = el.find('.title a').attr('href') || '';

      const cover = el.find('.cover img').attr('src') || '';
      const title = get('title');
      let series = get('.title .value .darkGreyText').replace(/\((.*)\)/, '$1');
      let seriesEntry = title.replace(`(${series})`, '').trim();
      let seriesNumber = null;

      if (series) {
        seriesNumber = (series.match(/#(\d+)/) || []).pop() || null;
        series = series.replace(/, #(\d+)/, '').trim();
      }

      const read = el
        .find('.date_read span')
        .map((i, _) => correctedDate($(_).text()).toJSON())
        .get();
      const start = el
        .find('.date_started span')
        .map((i, _) => correctedDate($(_).text()).toJSON())
        .get();

      let review = (el.find('td.review .value span:last-of-type').html() || '')
        .replace(/<br>/g, '\n')
        .replace(/<.*?>/g, '')
        .trim();

      const spoiler = review.startsWith('**spoiler alert**');
      if (spoiler) {
        review = review.replace('**spoiler alert**', '').trim();
      }

      return {
        title,
        seriesEntry,
        seriesNumber,
        series,
        author: get('author')
          .replace(/ \*$/, '')
          .split(', ')
          .reverse()
          .join(' '), // change to first name, last name
        pages: parseInt(get('num_pages'), 10),
        rating: parseInt(el.find('.rating .stars').attr('data-rating'), 10),
        read,
        start,
        published: new Date(get('date_pub')).getFullYear() || '?',
        goodreads: `https://www.goodreads.com${goodreads}`,
        goodreads_id: parseInt(
          goodreads.split('/').pop().split('-').shift(),
          10
        ),
        cover: cover.replace(/Y75/, 'X315').trim(),
        review: review || null,
        spoiler,
        slug: slug(title),
      };
    })
    .get();

  return res;
}

/**
 * @typedef {Object} Goodreads
 * @property {string} title
 * @property {string} seriesEntry
 * @property {string|null} [seriesNumber]
 * @property {string|null} [series]
 * @property {string} author
 * @property {number} pages
 * @property {number|null} rating 1-5
 * @property {string[]} read timestamp of times the book was finished, or if missing "?"
 * @property {string[]} start timestamp of times the book was started, or if missing "?"
 * @property {string} published year the book was published
 * @property {string} goodreads
 * @property {number} goodreads_id
 * @property {string} cover url to cover scaled to 315px wide
 * @property {string|null} [review]
 * @property {boolean} spoiler whether the review contains spoilers
 * @property {string} slug the slugified title
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const config = require('./config');

// Set variables
const PAGES_TOTAL = config.pagesTotal;
const WORKERS_LIMIT = config.workersLimit || 10;
const DIRECTORY_PATH = config.directoryPath;
const FILE_NAME = config.fileName;
const BASE_URL = config.baseUrl;

// Generate stack of pages
const pagesList = Array.from(Array(PAGES_TOTAL))
  .map((x, i) => i + 1)
  .reverse();

const crawlPage = async (workerID, page) => {
  const pageNumber = pagesList.pop();
  const url = BASE_URL.replace(/<%PAGE_NUMBER%>/g, pageNumber);
  console.log(
    `=> (WORKER ${workerID}) New job started. Crawling page ${pageNumber}`
  );
  await page.goto(url);

  // Removing unnecessary DOM Elements
  await page.evaluate(() => {
    const header = document.querySelector('header');
    const stickyHeader = document.querySelector(
      'body > div.Bgc\\(c-white\\).jsStickyHeader.Miw\\(1024px\\).W\\(100\\%\\).Z\\(100\\).Pos\\(f\\).Bxsh\\(boxShadow\\).TranslateY\\(-999px\\).T\\(0\\).Trs\\(transitionHeaderSticky\\)'
    );
    const topAdsBanner = document.querySelector(
      'body > div.Pos\\(r\\).Maw\\(970px\\).Mx\\(a\\).My\\(20px\\).jsLeaderboardSkyscrapper > div.leaderboardAds.Ta\\(c\\).jsLeaderboardAds'
    );
    const mainFooter = document.querySelector(
      'body > div.jsMainFooter.Bgc\\(\\#dfdfe4\\).Pt\\(20px\\).Pb\\(40px\\).Bgz\\(ct\\).Bgp\\(bgPosCenterBottom\\).Bgi\\(bgFooterK\\).Bgr\\(rx\\)'
    );
    const rightSidebar = document.querySelector(
      'body > div.jsMainContent.mainContent.Maw\\(970px\\).Mx\\(a\\).Mb\\(30px\\).D\\(f\\).jsStickyParent > div.sidebar.sidebarRight.jsSidebarRight.W\\(300px\\).D\\(f\\)'
    );
    const veryBottomFooter = document.querySelector(
      'body > div.Bgc\\(\\#464646\\).Py\\(20px\\)'
    );
    const recommendationThread = document.querySelector(
      '#thread_post_list > div.postlist-trh.no-border.middle'
    );

    header.style.display = 'none';
    stickyHeader.style.display = 'none';
    topAdsBanner.style.display = 'none';
    mainFooter.style.display = 'none';
    rightSidebar.style.display = 'none';
    veryBottomFooter.style.display = 'none';

    if (recommendationThread) recommendationThread.style.display = 'none';
  });

  // Print page to PDF
  await page.pdf({
    path: path.join(DIRECTORY_PATH, `${pageNumber}-${FILE_NAME}`),
    margin: {
      top: 50,
      bottom: 50,
    },
  });

  console.log(
    `=> (WORKER ${workerID}) Page number ${pageNumber} downloaded successfully`
  );

  if (pagesList.length > 0) {
    crawlPage(workerID, page);
  } else {
    console.log(
      `=> (WORKER ${workerID}) No job left, worker killed, closing the page !`
    );
    page.close();
  }

  return page;
};

(async () => {
  // Create new result's directory if it's not exist
  if (!fs.existsSync(path.join(config.directoryPath))) {
    console.log('(INFO) Cannot found output directory, creating a new one');
    fs.mkdir(path.join(config.directoryPath), () => {
      console.log('(INFO) Directory created');
    });
  }

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
  });

  let pages = [];

  console.log('=> (INFO) SPAWNING WORKERS');

  for (let i = (await browser.pages()).length; i < WORKERS_LIMIT; i++) {
    pages.push(browser.newPage());
  }

  pages = await Promise.all(pages);

  console.log('=> (INFO) WORKER SPAWNED !');
  console.log(
    '====================== JOB INFO ==============================='
  );
  console.log(`- BASE URL : ${BASE_URL}`);
  console.log(`- TOTAL PAGE : ${PAGES_TOTAL}`);
  console.log(`- WORKER LIMIT : ${WORKERS_LIMIT}`);
  console.log(
    `- RESULT FILE : ${path.join(DIRECTORY_PATH, `index-${FILE_NAME}`)}`
  );
  console.log(
    '==============================================================='
  );

  (await browser.pages()).forEach((page, i) => {
    crawlPage(i, page);
  });
})();

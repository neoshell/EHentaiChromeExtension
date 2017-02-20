var PATTERN_GALLERY_PAGE_URL = /https?:\/\/e[-x]hentai.org\/g\/*/;
var PATTERN_IMAGE_PAGE_URL = /https?:\/\/e[-x]hentai.org\/s\/*/;
var PATTERN_INVALID_FILENAME_CHAR = /[\\\/:\*\?\"<>\|]/g;

// Default config.
var DEFAULT_INTERMEDIATE_DOWNLOAD_PATH = 'e-hentai helper/';
var DEFAULT_SAVE_GALLERY_INFO = false;
var DEFAULT_SAVE_GALLERY_TAGS = false;
var DEFAULT_FILENAME_CONFLICT_ACTION = 'overwrite';

// User's config.
var intermediateDownloadPath = '';
var saveGalleryInfo = false;
var saveGalleryTags = false;
var filenameConflictAction = '';

// Gallery information.
var galleryFrontPageUrl = '';
var numGalleryPages = 0;
var galleryInfo = new Object();
var galleryTags = new Object();

// Basic Utils ================================================================

function getCurrentTabUrl(callback) {
  var queryInfo = {
    active: true,
    currentWindow: true
  };
  chrome.tabs.query(queryInfo, function(tabs) {
    var tab = tabs[0];
    var url = tab.url;
    callback(url);
  });
}

function httpGetAsync(url, callback) {
  var xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = function() {
    if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
      var responseText = xmlHttp.responseText;
      callback(responseText);
    }
  }
  xmlHttp.open('GET', url, true);
  xmlHttp.send(null);
}

function htmlToDOM(html, title) {
  var doc = document.implementation.createHTMLDocument(title);
  doc.documentElement.innerHTML = html;
  return doc;
}

function extractUrls(html) {
  var doc = htmlToDOM(html, '');
  var urls = [].slice.apply(doc.getElementsByTagName('a'));
  return urls;
}

function keyValuePairToString(key, val) {
  var separator = '\t';
  var terminator = '\n';
  return key + separator + val + terminator;
}

// Business logic =============================================================

function isEHentaiUrl(url) {
  return PATTERN_GALLERY_PAGE_URL.test(url);
}

function extractNumGalleryPages(html) {
  var numPages = 0;
  var doc = htmlToDOM(html, '');
  var elements = doc.getElementsByClassName('gpc');
  var pageInfoStr = elements[0].innerHTML;
  var patternImageNumbers = /Showing 1 - (\d+) of (\d+) images/;
  patternImageNumbers.exec(pageInfoStr);
  var numImagesPerPage = RegExp.$1;
  var totalNumImages = RegExp.$2;
  if (numImagesPerPage != null && totalNumImages != null) {
    numPages = Math.floor((parseInt(totalNumImages) - 1) /
                          parseInt(numImagesPerPage)) + 1;
  }
  return numPages;
}

function extractGalleryInfo(html) {
  var doc = htmlToDOM(html, '');
  var info = new Object();

  var name = doc.getElementById('gn').textContent;
  var nameInJapanese = doc.getElementById('gj').textContent;
  var category = doc.getElementById('gdc').childNodes[0].childNodes[0].alt;
  var uploader = doc.getElementById('gdn').childNodes[0].textContent;
  var gdt2ClassElements = doc.getElementsByClassName('gdt2');
  var posted = gdt2ClassElements[0].textContent;
  var parent = gdt2ClassElements[1].textContent;
  var visible = gdt2ClassElements[2].textContent;
  var language = gdt2ClassElements[3].textContent;
  var originalFileSizeMB = gdt2ClassElements[4].textContent;
  var numImages = gdt2ClassElements[5].textContent;
  var favorited = gdt2ClassElements[6].textContent;
  var ratingTimes = doc.getElementById('rating_count').textContent;
  var averageScore = doc.getElementById('rating_label').textContent;

  info.name = name != null ? name : '';
  info.nameInJapanese = nameInJapanese != null ? nameInJapanese : '';
  info.category = category != null ? category : '';
  info.uploader = uploader != null ? uploader : '';
  info.posted = posted != null ? posted : '';
  info.parent = parent != null ? parent : '';
  info.visible = visible != null ? visible : '';
  info.language = language != null ? language.replace(/\s+/, ' ') : '';
  info.originalFileSizeMB =
      originalFileSizeMB != null ?
      parseFloat(originalFileSizeMB.replace(/(\S+) MB/, '$1')) :
      0.0;
  info.numImages =
      numImages != null ?
      parseInt(numImages.replace(/(\d+) pages/, '$1')) :
      0;
  info.favorited =
      favorited != null ?
      parseInt(favorited.replace(/(\d+) times/, '$1')) :
      0;
  info.ratingTimes = ratingTimes != null ? parseInt(ratingTimes) : 0;
  info.averageScore =
      averageScore != null ?
      parseFloat(averageScore.replace(/Average: (\S+)/, '$1')) :
      0.0;
  return info;
}

function galleryInfoToString(info) {
  var str =
      keyValuePairToString('name:', info.name) +
      keyValuePairToString('name (Japanese):', info.nameInJapanese) +
      keyValuePairToString('category:', info.category) +
      keyValuePairToString('uploader:', info.uploader) +
      keyValuePairToString('posted:', info.posted) +
      keyValuePairToString('parent:', info.parent) +
      keyValuePairToString('visible:', info.visible) +
      keyValuePairToString('language:', info.language) +
      keyValuePairToString('original file size (MB):',
                           info.originalFileSizeMB) +
      keyValuePairToString('pages:', info.numImages) +
      keyValuePairToString('favorited:', info.favorited) +
      keyValuePairToString('rating times:', info.ratingTimes) +
      keyValuePairToString('average score:', info.averageScore);
  return str;
}

function extractGalleryTags(html) {
  var doc = htmlToDOM(html, '');
  var taglistElements =
      doc.getElementById('taglist').childNodes[0].childNodes[0].childNodes;
  var tags = new Array(taglistElements.length);
  for (var i = 0; i < taglistElements.length; i++) {
    var tr = taglistElements[i];
    tags[i] = new Object();
    tags[i].category = tr.childNodes[0].textContent;
    tags[i].content = '';
    var tagContentElements = tr.childNodes[1].childNodes;
    for (var j = 0; j < tagContentElements.length; j++) {
      if (j > 0) {
        tags[i].content += ', ';
      }
      tags[i].content += tagContentElements[j].textContent;
    }
  }
  return tags;
}

function galleryTagsToString(tags) {
  var str = '';
  for (var i in tags) {
    str += keyValuePairToString(tags[i].category, tags[i].content);
  }
  return str;
}

function extractImagePageUrls(html) {
  var urls = extractUrls(html);
  for (var i = 0; i < urls.length;) {
    if (PATTERN_IMAGE_PAGE_URL.test(urls[i])) {
      ++i;
    } else {
      urls.splice(i, 1);
    }
  }
  return urls;
}

function removeInvalidCharFromFilename(filename) {
  return filename.replace(PATTERN_INVALID_FILENAME_CHAR, ' ');
}

function downloadImages() {
  for (var i = 0; i < numGalleryPages; i++) {  // Page level.
    var galleryPageUrl = galleryFrontPageUrl + '?p=' + i;
    httpGetAsync(galleryPageUrl, function(responseText) {
      var imagePageUrls = extractImagePageUrls(responseText);
      for (var i in imagePageUrls) {  // Image level.
        httpGetAsync(imagePageUrls[i], function(responseText) {
          var doc = htmlToDOM(responseText, '');
          var imageUrl = doc.getElementById('img').src;
          var filename = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
          chrome.downloads.download({
              url: imageUrl,
              filename: intermediateDownloadPath + '/' + filename,
              conflictAction: filenameConflictAction});
        });
      }
    });
  }
}

function generateTxtFile(text, reletiveDownloadPath, conflictAction) {
  chrome.downloads.download({
      url: 'data:text;charset=utf-8,' + encodeURI(text),
      filename: reletiveDownloadPath,
      conflictAction: conflictAction});
}

// UI control =================================================================

function updateStatus(text) {
  document.getElementById('status').textContent = text;
}

function showDefaultDownloadFolder() {
  chrome.downloads.showDefaultFolder();
}

function buttonDownloadClick() {
  downloadImages();
  if (saveGalleryInfo) {
    generateTxtFile(galleryInfoToString(galleryInfo),
                    intermediateDownloadPath + '/info.txt',
                    filenameConflictAction);
  }
  if (saveGalleryTags) {
    generateTxtFile(galleryTagsToString(galleryTags),
                    intermediateDownloadPath + '/tags.txt',
                    filenameConflictAction);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  updateStatus('Initializing...');

  var buttonDownload = document.getElementById('download');
  buttonDownload.onclick = buttonDownloadClick;

  chrome.storage.sync.get({  // Load config.
    intermediateDownloadPath: DEFAULT_INTERMEDIATE_DOWNLOAD_PATH,
    saveGalleryInfo:          DEFAULT_SAVE_GALLERY_INFO,
    saveGalleryTags:          DEFAULT_SAVE_GALLERY_TAGS,
    filenameConflictAction:   DEFAULT_FILENAME_CONFLICT_ACTION
  }, function(items) {
    intermediateDownloadPath = items.intermediateDownloadPath;
    saveGalleryInfo = items.saveGalleryInfo;
    saveGalleryTags = items.saveGalleryTags;
    filenameConflictAction = items.filenameConflictAction;

    getCurrentTabUrl(function(url) {
      if (isEHentaiUrl(url)) {  // On valid page.
        galleryFrontPageUrl = url.substring(0, url.lastIndexOf('/') + 1);
        httpGetAsync(galleryFrontPageUrl, function(responseText) {
          numGalleryPages = extractNumGalleryPages(responseText);
          galleryInfo = extractGalleryInfo(responseText);
          galleryTags = extractGalleryTags(responseText);
          intermediateDownloadPath +=
              removeInvalidCharFromFilename(galleryInfo.name);
          buttonDownload.hidden = false;
          buttonDownload.disabled = false;
          updateStatus('Ready to download. ' +
                       'Please do NOT close the extension popup page ' +
                       'before download finished.');
        });
      } else {  // Not on valid page.
        buttonDownload.disabled = true;
        buttonDownload.hidden = true;
        updateStatus('The extension cannot work on current page. ' +
                     'Please go to E-Hentai gallery page.');
      }
    });
  });
});

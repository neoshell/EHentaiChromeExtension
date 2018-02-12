var PATTERN_INVALID_FILE_PATH_CHAR = /[:*?"<>|]/g;
var STATUS_SHOWING_DURATION = 1000;  // In ms.

// Default config.
var DEFAULT_INTERMEDIATE_DOWNLOAD_PATH = 'e-hentai helper/';
var DEFAULT_SAVE_ORIGINAL_IMAGES = false;
var DEFAULT_SAVE_GALLERY_INFO = false;
var DEFAULT_SAVE_GALLERY_TAGS = false;
var DEFAULT_FILENAME_CONFLICT_ACTION = 'uniquify';
var DEFAULT_DOWNLOAD_INTERVAL = 300;  // In ms.

// UI controls.
var inputIntermediateDownloadPath = null;
var inputSaveOriginalImages = null;
var inputSaveMetadataInfo = null;
var inputSaveMetadataTags = null;
var inputFilenameConflictActionUniquify = null;
var inputFilenameConflictActionOverwrite = null;
var inputDownloadInterval = null;

function showDefaultDownloadFolder() {
  chrome.downloads.showDefaultFolder();
}

// Returns null if the path is invalid.
function processFilePath(path) {
  if (PATTERN_INVALID_FILE_PATH_CHAR.test(path)) {
    return null;
  }
  path = path.replace(/\\/g, '/');
  if (path.charAt(path.length - 1) != '/') {
    path += '/';
  }
  return path;
}

function getFilenameConflictAction() {
  var filenameConflictAction = '';
  // Prompt mode is not supported, because it pops up too many prompt windows.
  if (document.getElementById('filenameConflictActionUniquify')
              .checked) {
    filenameConflictAction =
        document.getElementById('filenameConflictActionUniquify').value;
  } else if (document.getElementById('filenameConflictActionOverwrite')
                     .checked) {
    filenameConflictAction =
        document.getElementById('filenameConflictActionOverwrite').value;
  } else {
    // This should never happen. Set to default value in case.
    console.error('Error: unexpected filenameConflictAction value.');
    filenameConflictAction = DEFAULT_FILENAME_CONFLICT_ACTION;
  }
  return filenameConflictAction;
}

function updateStatus(text) {
  document.getElementById('status').textContent = text;
}

function showEphemeralStatus(text, duration) {
  updateStatus(text);
  setTimeout(function() {
    updateStatus('');
  }, duration);
}

function restoreOptions() {
  chrome.storage.sync.get({
    intermediateDownloadPath: DEFAULT_INTERMEDIATE_DOWNLOAD_PATH,
    saveOriginalImages:       DEFAULT_SAVE_ORIGINAL_IMAGES,
    saveGalleryInfo:          DEFAULT_SAVE_GALLERY_INFO,
    saveGalleryTags:          DEFAULT_SAVE_GALLERY_TAGS,
    filenameConflictAction:   DEFAULT_FILENAME_CONFLICT_ACTION,
    downloadInterval:         DEFAULT_DOWNLOAD_INTERVAL
  }, function(items) {  // Update UI.
    inputIntermediateDownloadPath.value = items.intermediateDownloadPath;
    inputSaveOriginalImages.checked = items.saveOriginalImages;
    inputSaveMetadataInfo.checked = items.saveGalleryInfo;
    inputSaveMetadataTags.checked = items.saveGalleryTags;
    if (items.filenameConflictAction ==
        inputFilenameConflictActionUniquify.value) {
      inputFilenameConflictActionUniquify.checked = true;
    } else if (items.filenameConflictAction ==
               inputFilenameConflictActionOverwrite.value){
        inputFilenameConflictActionOverwrite.checked = true;
    }
    inputDownloadInterval.value = items.downloadInterval;
  });
}

function saveOptions() {
  var intermediateDownloadPath = inputIntermediateDownloadPath.value;
  var saveOriginalImages = inputSaveOriginalImages.checked;
  var saveGalleryInfo = inputSaveMetadataInfo.checked;
  var saveGalleryTags = inputSaveMetadataTags.checked;
  var filenameConflictAction = getFilenameConflictAction();
  var downloadInterval = inputDownloadInterval.value;
  intermediateDownloadPath = processFilePath(intermediateDownloadPath);
  if (intermediateDownloadPath == null) {  // process file path.
    updateStatus('Failed to save options. ' +
                 'File path should not contain the following characters ' +
                 ': * ? " < > |');
    return;
  }
  inputIntermediateDownloadPath.value = intermediateDownloadPath;
  chrome.storage.sync.set({
    intermediateDownloadPath: intermediateDownloadPath,
    saveOriginalImages:       saveOriginalImages,
    saveGalleryInfo:          saveGalleryInfo,
    saveGalleryTags:          saveGalleryTags,
    filenameConflictAction:   filenameConflictAction,
    downloadInterval:         downloadInterval
  }, function() {  // Show a feedback message to user.
    showEphemeralStatus('Options saved.', STATUS_SHOWING_DURATION);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  inputIntermediateDownloadPath =
    document.getElementById('intermediateDownloadPath');
  inputSaveOriginalImages = document.getElementById('saveOriginalImages');
  inputSaveMetadataInfo = document.getElementById('saveMetadataInfo');
  inputSaveMetadataTags = document.getElementById('saveMetadataTags');
  inputFilenameConflictActionUniquify =
    document.getElementById('filenameConflictActionUniquify');
  inputFilenameConflictActionOverwrite =
    document.getElementById('filenameConflictActionOverwrite');
  inputDownloadInterval = document.getElementById('downloadInterval');

  document.getElementById('defaultDownloadFolder').onclick =
      showDefaultDownloadFolder;
  document.getElementById('save').onclick = saveOptions;

  restoreOptions();
});

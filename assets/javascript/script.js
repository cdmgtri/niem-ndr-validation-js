
let loading = {};

let ruleBase = "https://reference.niem.gov/niem/specification/naming-and-design-rules/4.0/niem-ndr-4.0.html#rule_";

/** @type {Object<string, FileMetadataType} */
let fileMetadataTracker = {};

let FileMetadataType = {
  name: "",
  isLoaded: false,
  size: "",
  lastModified: "",
  xsltPath: "",
  ruleSet: "",
  message: "",
  status: "",
  text: "",

  /** @type {XMLDocument} */
  xml: null,

  /** @type {IssueType[]} */
  issues: []
};

let IssueType = {
  fileName: "",
  lineNumber: 0,
  component: {
    kind: "",
    name: "",
    /** @type {HTMLElement} */
    node: null
  },
  rule: "",
  description: ""
};

/** @type {IssueType[]} */
let issues = [];

let doc = {
  $issues: $("#issues"),
  $fileStatus: $("#fileStatus"),
  $loadingIcon: $("#loadingIcon")
};


/**
 */
function loadFiles() {

  /** @type {FileList} */
  let files = document.getElementById("files").files;

  if (files.length == 0) {
    // Stop processing if no files have been loaded
    return;
  }

  // Clear any previous result info from the display
  resetResults();

  // Update the number of files selected
  setFileInputMessage(files);


  // Add a loading spinner to the page
  let spinner = `
  <i class="fa fa-circle-o-notch fa-spin fa-fw"></i>
  <span class="sr-only">Loading...</span>`;

  doc.$loadingIcon.html(spinner);

  for (let file of files) {

    // Add file name to the loading queue
    loading[file.name] = true;

    let date = new Date(file.lastModified);
    let timestamp = date.toLocaleString();

    /** @type {FileMetadataType} */
    let fileMetadata = {
      name: file.name,
      isLoaded: false,
      size: file.size,
      lastModified: timestamp,
      status: file.name.endsWith(".xsd") ? "Loading..." : "Not a XML schema file",
      issues: []
    };

    fileMetadataTracker[file.name] = fileMetadata;

    doc.$fileStatus.bootstrapTable("append", fileMetadata);

    // Process file contents
    let fileReader = new FileReader();

    fileReader.onload = (function (xsd) {
      return function (evt) {

        // Save file as text
        fileMetadata.text = evt.target.result;

        // Save file as XMLDocument
        let parser = new DOMParser();
        fileMetadata.xml = parser.parseFromString(fileMetadata.text, "text/xml");;

        // Choose which NDR stylesheet to use for this XSD file
        fileMetadata.xsltPath = getXSLTPath(fileMetadata);

        // Run NDR rules on file
        testNDRConformance(fileMetadata);
      }
    })(file);

    fileReader.readAsText(file);

  }
}


/**
 * Reset the display to remove previous file status and validation result
 * information.
 */
function resetResults() {

  // Reset data
  fileMetadataTracker = {};
  issues = [];

  // Clear the file status table
  doc.$fileStatus.bootstrapTable("removeAll");

  // Clear the issue results table
  doc.$issues.bootstrapTable("removeAll");

  // Remove status badge
  document.getElementById("svg").innerHTML = null;

  // Reset issue count
  let issueCount = document.getElementById("issue-count")
  issueCount.innerHTML = null;
  issueCount.classList.remove("badge-danger");
  issueCount.classList.remove("badge-success");
  issueCount.classList.remove("badge-warning");

  // Disable downloads
  disableLink("download-issues");
  disableLink("download-badge");

}


/**
 * Determine which NDR rule set should be used based on the user selection
 * or the XML schema contents (e.g., conformance targets attribute).
 *
 * Update the file metadata with the rule set used and a message about
 * how that rule set was chosen.
 *
 * Currently only supports NDR 4.0 REF and EXT rules.
 * Defaults to NDR 4.0 EXT if no user selection or conformance target is provided.
 *
 * @param {FileMetadataType} fileMetadata
 * @return {string} - The path to the NDR stylesheet
 */
function getXSLTPath(fileMetadata) {

  // User's NDR selection
  let selectedNDR = document.getElementById("ruleSet");

  // Base stylesheet path
  let xslBase = document.URL.replace("index.html", "") + "assets/ndr/";

  // Base NDR conformance target URL
  let ndrTargetBase = "http://reference.niem.gov/niem/specification/naming-and-design-rules/";


  if (selectedNDR.value != "auto") {
    // Handle user-selected NDR rule set
    fileMetadata.ruleSet = selectedNDR.value.replace("-", " ");
    fileMetadata.message = "Rule set selected by user";
    return xslBase + selectedNDR.value + ".sef";
  }

  // User selected auto-detect: determine the best rule set to use


  // Find the ct:conformanceTargets attribute on the schema
  let targets = fileMetadata.xml.documentElement.getAttributeNS("http://release.niem.gov/niem/conformanceTargets/3.0/", "conformanceTargets");


  // NDR 4.0 EXT
  if (targets.includes(ndrTargetBase + "4.0/#ExtensionSchemaDocument")) {
    fileMetadata.ruleSet = "NDR 4.0 EXT";
    fileMetadata.message = "Auto-detected from conformanceTargets attribute";
    return xslBase + "NDR-4.0-EXT.sef";
  }

  // NDR 4.0 REF
  if (targets.includes(ndrTargetBase + "4.0/#ReferenceSchemaDocument")) {
    fileMetadata.ruleSet = "NDR 4.0 REF";
    fileMetadata.message = "Auto-detected from conformanceTargets attribute";
    return xslBase + "NDR-4.0-REF.sef";
  }

  // NDR 3.0 EXT
  if (targets.includes(ndrTargetBase + "3.0/#ExtensionSchemaDocument")) {
    fileMetadata.ruleSet = "NDR 4.0 EXT";
    fileMetadata.message = "Closest match - NDR 3.0 validation not currently supported";
    return xslBase + "NDR-4.0-EXT.sef";
  }

  // NDR 3.0 REF
  if (targets.includes(ndrTargetBase + "3.0/#ReferenceSchemaDocument")) {
    fileMetadata.ruleSet = "NDR 4.0 REF";
    fileMetadata.message = "Closest match - NDR 3.0 validation not currently supported";
    return xslBase + "NDR-4.0-REF.sef";
  }

  // Default to NDR 4.0 EXT for no target specified
  fileMetadata.ruleSet = "NDR 4.0 EXT";
  fileMetadata.message = "Default - no conformance target specified"
  return xslBase + "NDR-4.0-EXT.sef";

}

/**
 * Runs the stylesheet transform to check NDR conformance of the XSD.
 *
 * @param {FileMetadataType} fileMetadata
 */
function testNDRConformance(fileMetadata) {

  // Run the XSLT to get conformance test results
  SaxonJS.transform({
      stylesheetLocation: fileMetadata.xsltPath,
      sourceText: fileMetadata.text
    },
    resultElement => processResults(fileMetadata, resultElement)
  );
}


/**
 * Parses the output of the NDR stylesheet transform into the issues
 * array and updates the page file status and issues list.
 *
 * @param {FileMetadataType} fileMetadata
 * @param {HTMLElement} svrl
 */
function processResults(fileMetadata, svrl) {

  // Parse the SVRL results of the XSLT transform
  parseIssues(fileMetadata, svrl);

  // Add file issues to the full issue array
  issues.push(...fileMetadata.issues);

  // Add file issues to the page issue table
  doc.$issues.bootstrapTable("append", fileMetadata.issues);

  // Update the overall file status with the results summary
  updateStatus(fileMetadata);

  // Remove file from the loading queue
  delete loading[fileMetadata.name];

  // Run final processing if the loading queue is now empty.
  if (Object.keys(loading).length == 0) {
    loaded();
  }
}


/**
 * Parses the results of the NDR stylesheet transform (a SVRL file)
 * into an issues array.
 *
 * @param {FileMetadataType} fileMetadata
 * @param {HTMLElement} svrl
 * @return {number} - The number of issues for the given file
 */
function parseIssues(fileMetadata, svrl) {

  let failedAsserts = svrl.getElementsByTagName("svrl:failed-assert");

  for (let failedAssert of failedAsserts) {

    // Get the matching component node from the XSD document
    let xPath = failedAssert.attributes["location"].nodeValue;
    let componentNode = getComponentNode(fileMetadata.xml, xPath);
    let componentNameAttribute = componentNode.attributes["name"];

    // Set issue values
    let name = componentNameAttribute ? componentNameAttribute.nodeValue : "";
    let kind = componentNode.localName;
    let msg = failedAssert.textContent;
    let [rule, description] = msg.split(": ");
    rule = rule.replace("Rule ", "");

    // Get the XSD line number of the issue
    let re = new RegExp(`${kind}\\s*name=.${name}`)
    let lineNumber = getLineNumber(fileMetadata.text, re);

    /** @type {IssueType} */
    let issue = {
      fileName: fileMetadata.name,
      lineNumber,
      component: {
        kind,
        name,
        node: componentNode
      },
      rule,
      description
    };

    // Add row to the issue list and HTML issue table
    fileMetadata.issues.push(issue);
  }

  return failedAsserts.length;
}


/**
 * Row style function for the Bootstrap Table plugin.
 *
 * Returns the row style for the file status table based on its loading
 * status and issue count.
 *
 * @param {FileMetadataType} fileMetadata
 */
function fileStatusStyle(fileMetadata) {

  // Style for file with conformance issues
  let variant = "table-danger";

  if (fileMetadata.isLoaded == false) {
    // Style for file that is still loading
    variant = "table-warning";
  }
  else if (fileMetadata.issues.length == 0) {
    // Style for file with no conformance issues
    variant = "table-success";
  }

  return {
    classes: [variant]
  };
}



/**
 * Detail formatter function for the Bootstrap Table plugin.
 *
 * Returns HTML displaying the issue's component XSD syntax for the
 * issue table row expansion.
 *
 * @param {number} index
 * @param {IssueType} issue
 */
function issueDetails(index, issue) {

  let xsd = issue.component.node.outerHTML
    .replace(" xmlns:xs=\"http://www.w3.org/2001/XMLSchema\"", "")
    .replace(" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"", "")
    .replace(" xmlns:xs='http://www.w3.org/2001/XMLSchema'", "")
    .replace(" xmlns:xsd='http://www.w3.org/2001/XMLSchema'", "")
    .trim();

  // The outerHTML loses the initial whitespace preceding the node, causing
  // the first line of the XSD not to align with the rest of the code.

  // Find the leading whitespace for the last line of the XSD text
  let lastLine = xsd.split("\n").pop();
  let leadingWhitespace = lastLine.split("<");

  if (leadingWhitespace.length > 0) {
    // Add the leading whitespace to the front of the XSD block
    xsd = leadingWhitespace[0] + xsd;
  }

  let highlightedXSD =  hljs.highlight("xml", xsd, true);

  return `<pre>${highlightedXSD.value}</pre>`;
}


/**
 * Detail filter function for the Bootstrap Table plugin.
 *
 * Determines whether or not the issue table row can be expanded
 * for the user to view the related XSD.
 *
 * Returns true if the issue is for a component (type, element, or attribute).
 * Returns false if the issue is schema-level.
 *
 * @param {number} index
 * @param {IssueType} issue
 */
function issueDetailsFilter(index, issue) {
  return issue.component.kind != "schema";
}

/**
 * Update the file status with a pass/fail message and row highlighting.
 *
 * @param {FileMetadataType} fileMetadata
 */
function updateStatus(fileMetadata) {

  // Update the status message
  if (fileMetadata.issues.length == 0) {
    fileMetadata.status = "All tests passed";
  }
  else if (fileMetadata.issues.length == 1) {
    fileMetadata.status = "1 test failed";
  }
  else {
    fileMetadata.status = fileMetadata.issues.length + " tests failed";
  }

  // Update the loading status
  fileMetadata.isLoaded = true;

  // Update the table row
  doc.$fileStatus.bootstrapTable("updateByUniqueId", fileMetadata.name, fileMetadata);
}


/**
 * Update the page after all of the issues have been processed.
 */
function loaded() {

  // Enable downloads
  enableLink("download-issues");
  enableLink("download-badge");

  // Remove the loading icon
  doc.$loadingIcon.html(null);

  // Set the issue count badge
  let issueCount = document.getElementById("issue-count");
  issueCount.innerText = issues.length;
  issueCount.classList.add(issues.length == 0 ? "badge-success" : "badge-danger");

  // Display the NDR NDR issue badge
  let div = document.getElementById("svg");
  div.innerHTML = getBadge();

  // Enable the reload button
  document.getElementById("reload").removeAttribute("disabled");
}


/**
 * Gets the document element with the given linkID.
 * Removes the "disabled" attribute and adds "href" attribute as "#".
 * @param {string} linkID
 */
function enableLink(linkID) {
  let link = document.getElementById(linkID);
  link.removeAttribute("disabled");
  link.setAttribute("href", "#");
}


/**
 * Gets the document element with the given linkID.
 * Adds the "disabled" attribute and removes the "href" attribute.
 * @param {string} linkID
 */
function disableLink(linkID) {
  let link = document.getElementById(linkID);
  link.removeAttribute("href");
  link.setAttribute("disabled", true);
}

/**
 * Generates a CSV of the issues.
 *
 * @returns {string}
 */
function getIssueCSV() {

  let csv = ['FileName,LineNumber,Component,Name,Rule,Link,Description'];

  issues.forEach( issue => {
    let link = `"=HYPERLINK(""${ruleBase}${issue.rule}"",""Rule ${issue.rule}"")"`;

    let row = `${issue.fileName},${issue.lineNumber},${issue.component.kind},${issue.component.name},Rule ${issue.rule},${link},${issue.description}`;

    csv.push(row);
  });

  return csv;
}

/**
 * Lets the user download the issue list as a CSV.
 *
 */
function saveIssues() {

  let csv = getIssueCSV();

  let blob = new Blob([csv.join("\n")],
    {type: "text/csv;charset=UTF-8", encoding: "UTF-8"}
  );

  saveAs(blob, "ndr-conformance-results.csv");
}

/**
 * Lets the user download the NIEM NDR conformance badge.
 */
function saveBadge() {
  let blob = new Blob([getBadge()], {type: "image/svg+xml;charset=utf-8"});
  saveAs(blob, "niem-ndr-badge.svg");
}


/**
 * Calculates the line number of the given pattern in the given
 * document string.
 *
 * Counts the number of '\n' preceding the pattern.
 *
 * @param {string} documentString
 * @param {RegExp} pattern
 * @return {number}
 */
function getLineNumber(documentString, pattern) {
  let index = documentString.search(pattern);
  let leadingText = documentString.substring(0, index);
  return leadingText.split("\n").length;
}

/**
 * Given an XSD document, finds the node at the given xpath.
 * Returns the component node (like a complexType or element node) that
 * the match belongs to, or the root schema node itself.
 *
 * @param {HTMLElement} xsdDocument
 * @param {string} xpath
 * @returns {HTMLElement}
 */
function getComponentNode(xsdDocument, xpath) {
  let xPathResult = document.evaluate(xpath, xsdDocument);
  let node = xPathResult.iterateNext();
  return getComponentRootNode(node);
}

/**
 * Returns the given node or recurses on the parent node until it reaches
 * a node that contains a "name" attribute.
 *
 * Returns the root schema node if the given node does not belong to a component.
 *
 * @param {HTMLElement} node
 * @returns {HTMLElement}
 */
function getComponentRootNode(node) {
  if (node.localName == "schema") {
    return node;
  }
  return node.attributes["name"] ? node : getComponentRootNode(node.parentNode);
}


/**
 * Update the document's fileMessage label with the number of files selected
 * @param {FileList} files
 */
function setFileInputMessage(files) {

  let msg = "No files chosen";

  if (files.length == 1) {
    msg = "1 file chosen";
  }
  else if (files.length > 1) {
    msg = files.length + " files chosen";
  }

  document.getElementById("fileInputMessage").innerText = msg;
}


function getBadge() {

  let count = issues.length;

  let Colors = {
    SUCCESS: "#4c1",
    ERROR: "#e05d44",
    WARNING: "#dfb317"
  }

  let color = count ? Colors.ERROR : Colors.SUCCESS;

  let svg = `<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  width="150" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1" />
    <stop offset="1" stop-opacity=".1" />
  </linearGradient>
  <clipPath id="a">
    <rect width="150" height="20" rx="3" fill="#fff" />
  </clipPath>
  <g clip-path="url(#a)">
    <path fill="#555" d="M0 0h67v20H0z" />
    <path fill="${color}" d="M67 0h83v20H67z" />
    <path fill="url(#b)" d="M0 0h150v20H0z" />
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="110">
    <text x="345" y="140" transform="scale(.1)" textLength="570">NIEM NDR</text>
    <text x="1060" y="140" transform="scale(.1)" textLength="700">${count} issues</text>
  </g>
</svg>`;

  return svg;
}

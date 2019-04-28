
let loading = {};

let ruleBase = "https://reference.niem.gov/niem/specification/naming-and-design-rules/4.0/niem-ndr-4.0.html#rule_";

/** @type {Object<string, FileMetadataType} */
let fileMetadataTracker = {};

let FileMetadataType = {
  name: "",
  size: "",
  lastModified: "",
  xsltPath: "",
  ruleSet: "",
  message: "",
  issueCount: 0,
  status: "",

  /** @type {string} */
  text: "",
  /** @type {XMLDocument} */
  xml: null,

  /** @type {"success"|"danger"|"warning"|"secondary"} */
  style: "",

  /** @type {IssueType[]} */
  issues: []
};

let IssueType = {
  fileName: "",
  lineNumber: 0,
  component: "",
  name: "",
  rule: "",
  description: ""
};

/** @type {IssueType[]} */
let issues = [];


/**
 */
function loadFiles() {

  /** @type {FileList} */
  let files = document.getElementById("files").files;

  if (files.length == 0) {
    // Stop processing if no files have been loaded
    return;
  }

  // Update the number of files selected
  setFileMessage(files);


  for (let file of files) {
    let date = new Date(file.lastModified);
    let timestamp = date.toLocaleString();


    // TODO: Refactor
    loading[file.name] = true;
    addStatus(file.name, "", "Loading...");



    /** @type {FileMetadataType} */
    let fileMetadata = {
      name: file.name,
      size: file.size,
      lastModified: timestamp,
      status: file.name.endsWith(".xsd") ? "Loading..." : "Not a XML schema file",
      style: file.name.endsWith(".xsd") ? "warning" : "secondary",
      issues: []
    };

    fileMetadataTracker[file.name] = fileMetadata;

    // Read file as text
    let fileReader = new FileReader();

    fileReader.onload = (function (xsd) {
      return function (evt) {
        let fileMetadata = fileMetadataTracker[file.name];

        let xsdString = evt.target.result;
        fileMetadataTracker[file.name].text = xsdString;

        // TODO: Read file as XMLDocument and trigger validation when done
        let parser = new DOMParser();

        /** @type {XMLDocument} */
        let xsdDoc = parser.parseFromString(xsdString, "text/xml");
        // let xsdDoc = $.parseXML(xsdString);


        fileMetadataTracker[file.name].xml = xsdDoc;

        let xsltPath = getXSLTPath(fileMetadata);
        fileMetadataTracker[file.name].xsltPath = xsltPath;

        runXSLT(file.name);
      }
    })(file);

    fileReader.readAsText(file);

  }
}

/**
 * Reset the results display and re-process the files.
 */
function reloadFiles() {
  resetResults();
  loadFiles();
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
  let tbl = document.getElementById("status");
  while (tbl.rows.length > 1) {
    tbl.deleteRow(1);
  }

  // Clear issue results table
  tbl = document.getElementById("log");
  while (tbl.rows.length > 1) {
    tbl.deleteRow(1);
  }

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


function loadSchema(xsdPath) {

  let fileName = getFileName(xsdPath);

  let schemaFile = new XMLHttpRequest();
  schemaFile.open("GET", xsdPath, true);
  schemaFile.send(null);

  schemaFile.onreadystatechange = function() {
    if (schemaFile.readyState === 4 && schemaFile.status == 200) {
      xsdDocuments[fileName] = schemaFile.responseXML;
      textDocuments[fileName] = schemaFile.responseText;

      let xsltPath = getXSLTPath(fileName);

      runXSLT(xsdPath, xsltPath);
    }
  };
}

/**
 *
 * @param {FileMetadataType} fileMetadata
 */
function getXSLTPath(fileMetadata) {

  let xsdDocument = fileMetadata.xml;

  let xslBase = document.URL.replace("index.html", "") + "assets/ndr/";
  let ndrTargetBase = "http://reference.niem.gov/niem/specification/naming-and-design-rules/";

  let userSelection = document.getElementById("ruleSet");

  if (userSelection.value == "NDR-4.0-EXT") {
    fileMetadata.ruleSet = "NDR 4.0 EXT";
    fileMetadata.message = "Rule set selected by user";
    return xslBase + "NDR-4.0-EXT.sef";
  }
  else if (userSelection.value == "NDR-4.0-REF") {
    fileMetadata.ruleSet = "NDR 4.0 REF";
    fileMetadata.message = "Rule set selected by user";
    return xslBase + "NDR-4.0-REF.sef";
  }


  // Find the ct:conformanceTargets attribute on the schema
  let targets = xsdDocument.documentElement.getAttributeNS("http://release.niem.gov/niem/conformanceTargets/3.0/", "conformanceTargets");


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

  // Default for no target specified
  fileMetadata.ruleSet = "NDR 4.0 EXT";
  fileMetadata.message = "Default - no conformance target specified"
  return xslBase + "NDR-4.0-EXT.sef";

}

/**
 * @param {string} fileName
 */
function runXSLT(fileName) {

  let fileMetadata = fileMetadataTracker[fileName];

  // Run the XSLT to get conformance test results
  SaxonJS.transform({
      stylesheetLocation: fileMetadata.xsltPath,
      sourceText: fileMetadata.text
    },
    resultElement => {

      // Parse the SVRL results of the XSLT transform
      fileMetadata.issueCount = parseIssues(fileName, resultElement, "log");

      // Remove loading message
      updateStatus(fileName, fileMetadata);
    });
}

function addStatus(fileName, ruleSet, status) {

  let cellFileName = document.createElement("td");
  let cellRuleSet = document.createElement("td");
  let cellMessage = document.createElement("td");
  let cellStatus = document.createElement("td");

  cellFileName.innerHTML = fileName;
  cellRuleSet.innerHTML = ruleSet;
  cellMessage.innerHTML = "";
  cellStatus.innerHTML = status;

  let tbl = document.getElementById("status").children[0];
  let row = document.createElement("tr");

  row.setAttribute("id", "status." + fileName);
  row.setAttribute("class", "table-warning");
  row.appendChild(cellFileName);
  row.appendChild(cellRuleSet);
  row.appendChild(cellMessage);
  row.appendChild(cellStatus);

  tbl.appendChild(row);

  fileMetadataTracker[fileName] = {
    status: "Loading..."
  };
}

/**
 * Update the file status with a pass/fail message and row highlighting.
 *
 * @param {string} fileName
 * @param {FileMetadataType} fileStatus
 */
function updateStatus(fileName, fileStatus) {

  let row = document.getElementById("status." + fileName);

  let status = "All tests passed";
  let style = "table-success";

  if (fileStatus.issueCount != 0) {
    status = fileStatus.issueCount + " tests failed";
    style = "table-danger";
  }

  // Update cell values
  row.children[1].innerHTML = fileStatus.ruleSet;
  row.children[2].innerHTML = fileStatus.message;
  row.children[3].innerHTML = status;

  // Set row style
  row.setAttribute("class", style);

  // Remove file from loading queue and execute final processing if queue is empty.
  delete loading[fileName];
  if (Object.keys(loading).length == 0) {
    loaded();
  }
}

/**
 * Final processing after all data has loaded.
 */
function loaded() {

  enableLink("download-issues");
  enableLink("download-badge");

  let issueCount = document.getElementById("issue-count");
  issueCount.innerText = issues.length;
  issueCount.classList.add(issues.length == 0 ? "badge-success" : "badge-danger");

  let div = document.getElementById("svg");
  div.innerHTML = getBadge();

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

function saveIssues() {

  let csv = ['FileName,LineNumber,Component,Name,Rule,Link,Description'];

  issues.forEach( issue => {
    let link = `"=HYPERLINK(""${ruleBase}${issue.rule}"",""Rule ${issue.rule}"")"`;

    let row = `${issue.fileName},${issue.lineNumber},${issue.component},${issue.name},Rule ${issue.rule},${link},${issue.description}`;

    csv.push(row);
  });

  let blob = new Blob([csv.join("\n")],
    {type: "text/csv;charset=UTF-8", encoding: "UTF-8"}
  );
  saveAs(blob, "ndr-conformance-results.csv");
}

function saveBadge() {
  let blob = new Blob([getBadge()], {type: "image/svg+xml;charset=utf-8"});
  saveAs(blob, "niem-ndr-badge.svg");
}

/**
 * @param {string} fileName
 * @param {HTMLElement} svrl
 * @param {string} tableID
 */
function parseIssues(fileName, svrl, tableID) {

  let table = document.getElementById(tableID).firstElementChild;

  let failedAsserts = svrl.getElementsByTagName("svrl:failed-assert");

  for (let failedAssert of failedAsserts) {

    let fileMetadata = fileMetadataTracker[fileName];

    // Get the matching component node from the XSD document
    let xPath = failedAssert.attributes["location"].nodeValue;
    let componentNode = getComponentNode(fileMetadata.xml, xPath);
    let nameAttribute = componentNode.attributes["name"];

    // Set row field values
    let name = nameAttribute ? nameAttribute.nodeValue : "";
    let kind = componentNode.localName;
    let msg = failedAssert.textContent;
    let [rule, description] = msg.split(": ");
    rule = rule.replace("Rule ", "");

    // Get the line number
    let re = new RegExp(`${kind}\\s*name=.${name}`)
    let lineNumber = getLineNumber(fileMetadata.text, re);

    /** @type {IssueType} */
    let issue = {
      fileName,
      lineNumber,
      component: kind,
      name,
      rule,
      description
    };

    // Add row to the issue list and HTML issue table
    issues.push(issue);
    fileMetadata.issues.push(issue);
    addRow(table, issue);
  }

  return failedAsserts.length;

}

/**
 * Given a document string, counts the number of '\n' from the start to the
 * position of the given pattern.
 *
 * @param {string} documentString
 * @param {RegExp} pattern
 */
function getLineNumber(documentString, pattern) {
  let index = documentString.search(pattern);
  let leadingText = documentString.substring(0, index);
  return leadingText.split("\n").length;
}

/**
 * Given an XSD document, returns the value from the given xpath.
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
 * Returns the node or recurses on the parent node until it reaches a node
 * that contains a "name" attribute.
 *
 * @param {HTMLElement} node
 */
function getComponentRootNode(node) {
  if (node.localName == "schema") {
    return node;
  }
  return node.attributes["name"] ? node : getComponentRootNode(node.parentNode);
}

/**
 *
 *
 * @param {Element} tableNode
 * @param {IssueType} issue
 */
function addRow(tableNode, issue) {

  let cellFileName = document.createElement("td");
  let cellLineNumber = document.createElement("td");
  let cellComponent = document.createElement("td");
  let cellName = document.createElement("td");
  let cellRule = document.createElement("td");
  let cellDescription = document.createElement("td");

  cellFileName.innerHTML = issue.fileName;
  cellLineNumber.innerHTML = issue.lineNumber;
  cellComponent.innerHTML = issue.component;
  cellName.innerHTML = issue.name;
  cellRule.innerHTML = `<a href="${ruleBase}${issue.rule}" target="_blank">${issue.rule}</a>`;
  cellDescription.innerHTML = issue.description;

  let row = tableNode.appendChild( document.createElement("tr") );

  row.appendChild(cellFileName);
  row.appendChild(cellLineNumber);
  row.appendChild(cellComponent);
  row.appendChild(cellName);
  row.appendChild(cellRule);
  row.appendChild(cellDescription);

}


/**
 * Update the document's fileMessage label with the number of files selected
 * @param {FileList} files
 */
function setFileMessage(files) {

  let msg;

  if (files.length == 0) {
    msg = "No files chosen";
  }
  else if (files.length = 1) {
    msg = "1 file chosen";
  }
  else {
    msg = files.length + " files chosen";
  }

  document.getElementById("fileMessage").innerText = msg;
}

function getBadge() {

  let count = issues.length;

  let color = count ? "#e05d44" : "#4c1";
  // warning color: #dfb317

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
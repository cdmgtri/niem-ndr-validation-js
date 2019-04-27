
let loading = {};
let xsdDocuments = {};
let textDocuments = {};

let ruleBase = "https://reference.niem.gov/niem/specification/naming-and-design-rules/4.0/niem-ndr-4.0.html#rule_";

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
 * Tests each XSD in the base-xsd/extension directory
 */
function validateExtensionSchemas() {
  validateFile("http://localhost:8080/base-xsd/extension/extension.xsd");
  validateFile("http://localhost:8080/base-xsd/extension/test-1.xsd");
  validateFile("http://localhost:8080/base-xsd/extension/test-2.xsd");
}

/**
 * Adds the file name from the given xsdPath to the status page element as loading.
 * Loads the XSD file at the given xsdPath as an XML document.
 * Starts the XSLT transformation.
 *
 * @param {string} xsdPath
 */
function validateFile(xsdPath) {

  let fileName = xsdPath.split("/").pop();

  loading[fileName] = true;

  // Set status for the file
  addStatus(fileName, "", "Loading...");

  // Load the input schema
  loadSchema(xsdPath, fileName);

  let ndrPath = "http://localhost:8080/assets/ndr/ndr-rules-conformance-target-ext.sef";

  // Run the XSLT to get conformance test results
  SaxonJS.transform({
      stylesheetLocation: ndrPath,
      sourceLocation: xsdPath
    },
    resultElement => {
      // Parse the SVRL results of the XSLT transform
      let issueCount = parseIssues(fileName, resultElement, "log");

      // Remove loading message
      updateStatus(fileName, "NDR 4.0 EXT", issueCount);
    });
}

function addStatus(fileName, ruleSet, status) {

  let cellFileName = document.createElement("td");
  let cellRuleSet = document.createElement("td");
  let cellStatus = document.createElement("td");

  cellFileName.innerHTML = fileName;
  cellRuleSet.innerHTML = ruleSet;
  cellStatus.innerHTML = status;

  let tbl = document.getElementById("status").children[0];
  let row = document.createElement("tr");

  row.setAttribute("id", "status." + fileName);
  row.setAttribute("class", "table-warning");
  row.appendChild(cellFileName);
  row.appendChild(cellRuleSet);
  row.appendChild(cellStatus);

  tbl.appendChild(row);
}

/**
 * Update the file status with a pass/fail message and row highlighting.
 *
 * @param {string} fileName
 * @param {string} ruleSet
 * @param {number} issueCount
 */
function updateStatus(fileName, ruleSet, issueCount) {

  let row = document.getElementById("status." + fileName);

  let msg = "All tests passed";
  let style = "table-success";

  if (issueCount != 0) {
    msg = issueCount + " tests failed";
    style = "table-danger";
  }

  // Update cell values
  row.children[1].innerHTML = ruleSet;
  row.children[2].innerHTML = msg;

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
  issueCount.innerText = `(${issues.length})`;

  let div = document.getElementById("svg");
  div.innerHTML = getBadge();
}

/**
 * Gets the HTML element with the given linkID.
 * Removes the "disabled" attribute and adds "href" attribute as "#".
 */
function enableLink(linkID) {
  let link = document.getElementById(linkID);
  link.removeAttribute("disabled");
  link.setAttribute("href", "#");
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

function loadSchema(xsdPath, fileName) {

  let schemaFile = new XMLHttpRequest();
  schemaFile.open("GET", xsdPath, true);
  schemaFile.send(null);

  schemaFile.onreadystatechange = function() {
    if (schemaFile.readyState === 4 && schemaFile.status == 200) {
      xsdDocuments[fileName] = schemaFile.responseXML;
      textDocuments[fileName] = schemaFile.responseText;
    }
  };
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

    /** @type {HTMLElement} */
    let xsdDocument = xsdDocuments[fileName];

    // Get the matching component node from the XSD document
    let xPath = failedAssert.attributes["location"].nodeValue;
    let componentNode = getComponentNode(xsdDocument, xPath);

    // Set row field values
    let name = componentNode.attributes["name"].nodeValue;
    let kind = componentNode.localName;
    let msg = failedAssert.textContent;
    let [rule, description] = msg.split(": ");
    rule = rule.replace("Rule ", "");

    // Get the line number
    let re = new RegExp(`${kind}\\s*name=.${name}`)
    let lineNumber = getLineNumber(textDocuments[fileName], re);

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
 * @param {Node} node
 */
function getComponentRootNode(node) {
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
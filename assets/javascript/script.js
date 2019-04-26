
let xsdDocuments = {};
let textDocuments = {};

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

      // Save results to file
      let svrl = resultElement.outerHTML;
      let blob = new Blob([svrl], {type: "text/plain;charset=utf-8"});
      // saveAs(blob, "results.svrl");

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
    let [rule, desc] = msg.split(": ");
    rule = rule.replace("Rule ", "");

    // Get the line number
    let re = new RegExp(`${kind}\\s*name=.${name}`)
    let lineNumber = getLineNumber(textDocuments[fileName], re);

    // Add row to the issue list
    addRow(table, fileName, lineNumber, kind, name, rule, desc);
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
 * @param {string} fileName
 * @param {string} lineNumber
 * @param {string} component
 * @param {string} name
 * @param {string} rule
 * @param {string} description
 */
function addRow(tableNode, fileName, lineNumber, component, name, rule, description) {

  let cellFileName = document.createElement("td");
  let cellLineNumber = document.createElement("td");
  let cellComponent = document.createElement("td");
  let cellName = document.createElement("td");
  let cellRule = document.createElement("td");
  let cellDescription = document.createElement("td");

  cellFileName.innerHTML = fileName;
  cellLineNumber.innerHTML = lineNumber;
  cellComponent.innerHTML = component;
  cellName.innerHTML = name;
  cellRule.innerHTML = rule;
  cellDescription.innerHTML = description;

  let row = tableNode.appendChild( document.createElement("tr") );

  row.appendChild(cellFileName);
  row.appendChild(cellLineNumber);
  row.appendChild(cellComponent);
  row.appendChild(cellName);
  row.appendChild(cellRule);
  row.appendChild(cellDescription);

}

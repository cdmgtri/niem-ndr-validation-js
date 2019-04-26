
function test(msg) {
  console.log("******", msg, "******");
}

/**
 * @param {HTMLElement} xsdDocument
 * @param {HTMLElement} svrl
 * @param {string} tableID
 * @param {string} summaryID
 */
function parseIssues(xsdDocument, svrl, tableID, summaryID) {

  let table = document.getElementById(tableID).firstElementChild;

  let failedAsserts = svrl.getElementsByTagName("svrl:failed-assert");

  for (let failedAssert of failedAsserts) {

    // Get the matching component node from the XSD document
    let xPath = failedAssert.attributes["location"].nodeValue;
    let componentNode = getComponentNode(xsdDocument, xPath);

    // Set row field values
    let name = componentNode.attributes["name"].nodeValue;
    let kind = componentNode.localName;
    let msg = failedAssert.textContent;
    let [rule, desc] = msg.split(": ");
    rule = rule.replace("Rule ", "");

    // Add row to the issue list
    addRow(table, "FILE NAME", "#", kind, name, rule, desc);
  }

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

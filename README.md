
# NIEM JS - NDR Validation

Run NDR conformance rules against XML schemas.

## Status

This project uses Saxon-JS to transform NIEM XML schemas with pre-compiled NDR XSL rules (compiled via Oxygen) to generate a list of conformance issues.  Saxon-JS is currently only implemented for browser support; a Node.js version is projected to be released this year.  At that point, this code can be refactored so that NDR validation can be run offline, via node, a npm script, Travis, etc.

- [x] Local web server to provide hard-coded input file access
- [x] Validate XSDs against pre-compiled 4.0 EXT NDR rules.
- [x] Parse resulting SVRL to display results
- [x] Save conformance report
- [ ] Create NDR badge
- [ ] Link results to NDR rules
- [ ] Support multiple NDR rule sets
  - [ ] Compile and save NDR rule files
  - [ ] Parse each XSD and determine appropriate NDR rule set
- [ ] Replace hard-coded XSDs with user file selections
- [ ] Use NIEM tool template
- [ ] Refactor Saxon-JS for Node.js implementation once available

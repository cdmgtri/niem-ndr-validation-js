
# NIEM JS - NDR Validation

Run NDR conformance rules against XML schemas.

## Status

This project uses Saxon-JS to transform NIEM XML schemas with pre-compiled NDR XSL rules (compiled via Oxygen) to generate a list of conformance issues.  Saxon-JS is currently only implemented for browser support; a Node.js version is projected to be released this year.  At that point, this code can be refactored so that NDR validation can be run offline, via node, a npm script, Travis, etc.

- [x] Local web server to provide hard-coded input file access
- [x] Validate XSDs against pre-compiled 4.0 NDR rules.
- [x] Parse resulting SVRL to display results
- [x] Save conformance report
- [x] Save conformance badge
- [x] Support multiple NDR rule sets

## Saxon JS

Check licensing for [Saxon JS](http://www.saxonica.com/saxon-js/index.xml).

## Compiling SEFs

In Oxygen, go to Tools > Compile XSL stylesheet for Saxon...

- Select `XSL URL`: Browse to the appropriate NDR `.sch.xsl` file from the full NDR zip.
- Select `Target` as "Saxon-JS"
- Make sure `Relocatable` is checked.
- Select output file, e.g., "NDR-4.0-EXT.sef"

## No support for NDR 3.0

The NDR 3.0 schematron files do not generate the same SVRL output as do the 4.0 files, so they are not supported at this time.

# utar

A JavaScript utility for extracting __tar__ archives.

## Goal

Extract POSIX TAR archives without third party dependencies

## Example

```JavaScript
	const {readFileSync}   = require('fs')
	const {extractEntries} = require('@popovmp/utar')

	const tarball    = readFileSync(filepath)
	const detination = './base/path'

	extractEntries(tarball, destination)
```

`tarball` is a `Buffer`. It can be read from a file or received by a TCP request.


# tar

A JavaScript utility for creating and extracting __tar__ archives.

## Goal

__tar__ supports __UStar__ format.

## Example

```JavaScript
	const {readFileSync} = require('fs')
	const {extract}     = require('@popovmp/utar')

	const tarball    = readFileSync(filepath)
	const detination = './base/path'

	extract(tarball, destination)
```

`tarball` is a `Buffer`. It can be read from a file or received by a TCP request.


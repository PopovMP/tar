# tar

A Nodejs utility for creating and extracting __tar__ archives programmatically.

## Purpose

To be used programmatically for creating and extracting updates in tar format.

The created tar can be compressed or decompressed by the Nodejs zlib. 

__tar__ create archive in `POSIX 1003.1-1988 (ustar)` format.

## Goals

- to create and extracts __tar__ archives in __UStar__ format.
- to be compatible with __7-Zip__ and the Linux __tar__  command.
- to have an easy, eat all, API.
- to have a more detailed API for hacking.
- use relative paths from the parent of the 'target' directory

## Examples

### Tar all

Archive a complete directory to a tar archive.

Here `target` can be a path to a directory or a single file. 

```JavaScript
const {createArchive} = require('@popovmp/tar')

const tarPath = 'stuff.tar'
const target  = './path/to/stuff'

createArchive(tarPath, target)
```

### Extract all

Extract a __tar__ archive from `tarPath` into the `destination` directory. 

```JavaScript
const {extractArchive} = require('@popovmp/tar')

const tarPath     = 'stuff.tar'
const destination = './destination'

extractArchive(tarPath, destination)
```

### Extract a Buffer

`tarball` is a `Buffer`. It can be read from a file or received by a TCP request.

```JavaScript
const {extractArchive} = require('@popovmp/tar')

const tarball     = getBufferSomehow()
const destination = './destination'

extract(tarball, destination)
```

### Create tar by entry paths

Create a __tar__ Buffer given a list of entry paths and a base directory.

This is useful if you want to precise the tar content. 

```JavaScript
const {getEntryStats, create} = require('@popovmp/tar')
const {gzipSync} = require('node:zlib')

const baseDir    = './base'
const entryPaths = [
	'stuff/',
	'stuff/hello.txt',
	'stuff/inner/',
	'stuff/inner/other.bin',
]

const entryStats = getEntryStats(baseDir, entryPaths)
const tarball    = create(baseDir, entryStats)
const tarGz      = gzipSync(tarball)

// Save tarGz to file or send it via network.
```

### Get entry paths

Read all entry pats of a target directory.

It is useful if you want to manually add or remove paths to archive.

```JavaScript
const {getEntryPaths} = require('@popovmp/tar')

const target     = './path/to/stuff'
const entryPaths = getEntryPaths(target)

console.log(entryPaths.join('\n'))    

/* 
"stuff/"
"stuff/hello.txt"
"stuff/inner/"
"stuff/inner/other.bin"
*/
```

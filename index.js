'use strict'

const {join, dirname, basename, sep} = require('path')
const {existsSync, mkdirSync, opendirSync, statSync, readFileSync, writeFileSync} = require('fs')

/**
 * @typedef {NodeModule}
 *
 * Wikipedia: tar (computing) : https://en.wikipedia.org/wiki/Tar_(computing)
 * GNU: Basic Tar Format: https://www.gnu.org/software/tar/manual/html_node/Standard.html
 * IBM zOS: tar - Format of tar archives: https://www.ibm.com/docs/en/zos/2.5.0?topic=formats-tar-format-tar-archives
 */

/**
 * @typedef {Object} EntryStats
 *
 * @property {string} name     - entry name
 * @property {string} typeflag - '0' - file, '5' - directory
 * @property {number} size     - entry size
 * @property {number} mtime    - modify time
 * @property {string} prefix   - prefix
 */

/**
 * @typedef {Object} TarHeader
 *
 * The 'prefix' field provides an opportunity to input information about the pathname if it is too long
 * for the allotted 100 bytes. If the prefix field is not empty, the reader will prepend the prefix value
 * and a '/' character to the name field to create the full pathname.
 *
 * The checksum is calculated by taking the sum of the unsigned byte values of the header record with the
 * eight checksum bytes taken to be ASCII spaces (decimal value 32).
 * It is stored as a six digit octal number with leading zeroes followed by a NUL and then a space.
 *
 * @property {string} name     - entry name  (ASCII 100b)
 * @property {number} mode     - access mode (Octal  8b as a null-terminated string)
 * @property {number} uid      - user ID     (Octal  8b as a null-terminated string)
 * @property {number} gid      - group ID    (Octal  8b as a null-terminated string)
 * @property {number} size     - entry size  (Octal 12b as a null-terminated string)
 * @property {number} mtime    - modify time - seconds from Epoch (Octal 12b as a null-terminated string)
 * @property {number} checksum - header check sum (Octal 7b as a null-terminated string + space)
 * @property {string} typeflag - entry type: (ASCII 1b); '0' - file, '1' - hard link, '2' - symbolic link, '5' - directory
 * @property {string} linkname - linked file name: (ASCII 100b null-terminated string)
 * @property {string} magic    - 'ustar' + null (ASCII 6b null-terminated string)
 * @property {string} version  - '00'
 * @property {string} uname    - user  name (ASCII 32b null-terminated string)
 * @property {string} gname    - group name (ASCII 32b null-terminated string)
 * @property {string} devmajor - devise minor number (Octal  8b as a null-terminated string)
 * @property {string} devminor - device major number (Octal  8b as a null-terminated string)
 * @property {string} prefix   - prefix (ASCII 155b)
 */

/**
 * @typedef {Object} HeaderField
 *
 * @property {string} name
 * @property {number} offset
 * @property {number} length
 * @property {string} encoding
 */

/** @type { Record<string, HeaderField> } */
const FIELDS = {
	name:     {name: 'name',     offset:   0, length: 100, encoding: 'ascii'},
	mode:     {name: 'mode',     offset: 100, length:   8, encoding: 'octal'},
	uid:      {name: 'uid',      offset: 108, length:   8, encoding: 'octal'},
	gid:      {name: 'gid',      offset: 116, length:   8, encoding: 'octal'},
	size:     {name: 'size',     offset: 124, length:  12, encoding: 'octal'},
	mtime:    {name: 'mtime',    offset: 136, length:  12, encoding: 'octal'},
	checksum: {name: 'checksum', offset: 148, length:   8, encoding: 'octal'},
	typeflag: {name: 'typeflag', offset: 156, length:   1, encoding: 'ascii'},
	linkname: {name: 'linkname', offset: 157, length: 100, encoding: 'ascii'},
	magic:    {name: 'magic',    offset: 257, length:   6, encoding: 'ascii'},
	version:  {name: 'version',  offset: 263, length:   2, encoding: 'ascii'},
	uname:    {name: 'uname',    offset: 265, length:  32, encoding: 'ascii'},
	gname:    {name: 'gname',    offset: 297, length:  32, encoding: 'ascii'},
	devmajor: {name: 'devmajor', offset: 329, length:   8, encoding: 'octal'},
	devminor: {name: 'devminor', offset: 337, length:   8, encoding: 'octal'},
	prefix:   {name: 'prefix',   offset: 345, length: 155, encoding: 'ascii'},
}

const BLOCK_LENGTH     = 512
const FILE_TYPE        = '0'
const DIR_TYPE         = '5'

/**
 * Creates a tar archive at 'tarPath' from the 'target'.
 * The 'target' can be a directory or a single file.
 *
 * @param {string} tarPath - path to the tar file
 * @param {string} target  - path to a file or a directory to archive
 *
 * @return {void}
 */
function createArchive(tarPath, target)
{
	if (!existsSync(target))
		throw new Error(`cannot open directory: ${target}`)

	const /** @type {string}       */ baseDir    = dirname(target)
	const /** @type {string[]}     */ entryPaths = getEntryPaths(target)
	const /** @type {EntryStats[]} */ entryStats = getEntryStats(baseDir, entryPaths)
	const /** @type {Buffer}       */ tarball    = create(baseDir, entryStats)

	writeFileSync(tarPath, tarball)
}

/**
 * Extracts all entries from a tar archive at 'tarPath' to a 'destination' directory.
 *
 * @param {string} tarPath     - path to the tar archive
 * @param {string} destination - path to destination directory
 *
 * @return {void}
 */
function extractArchive(tarPath, destination)
{
	if (!existsSync(tarPath))
		throw new Error(`cannot find tar archive: ${tarPath}`)

	if (!existsSync(destination))
		throw new Error(`cannot open destination directory: ${destination}`)

	const /** @type {Buffer} */ tarball = readFileSync(tarPath)

	extract(tarball, destination)
}

/**
 * Reads headers from a tarball
 *
 * @param {Buffer} tar
 *
 * @return {TarHeader[]}
 */
function readHeaders(tar)
{
	const headers = []

	let offset = 0
	while (true) {
		/** @type {TarHeader} */
		const header = parseHeader(tar, offset)

		if (header.typeflag !== FILE_TYPE && header.typeflag !== DIR_TYPE)
			break // Reached the final empty block

		const checksum = getCheckSum(tar, offset)
		if (checksum !== header.checksum)
			throw new Error(`wrong checksum of: ${header.name}`)

		headers.push(header)

		// Jump to the next header
		offset += getOffsetDelta(header.size)
	}

	return headers
}

/**
 * Gets the offset delta depending on the entry size
 *
 * @param {number} size - entry size
 *
 * @return {number}
 */
function getOffsetDelta(size)
{
	return (Math.ceil(size / BLOCK_LENGTH) + 1) * BLOCK_LENGTH
}

/**
 * Parses a record's header
 *
 * @param {Buffer} tar
 * @param {number} offset
 *
 * @return {TarHeader}
 */
function parseHeader(tar, offset)
{
	/** @type {TarHeader} */
	const header = {}
	for (const name of Object.keys(FIELDS))
		header[name] = parseFieldValue(tar, offset, FIELDS[name])

	return header
}

/**
 * Parses a header field
 *
 * It reads bytes until field's length or a null.
 * Then, it casts the value to string or a number,
 *
 * @param {Buffer}      tar
 * @param {number}      offset
 * @param {HeaderField} field
 *
 * @return {number|string}
 */
function parseFieldValue(tar, offset, field)
{
	const from = offset + field.offset
	let   to   = from
	while (tar[to] > 0 && to < from + field.length)
		to += 1

	const textValue = tar.subarray(from, to).toString()

	return field.encoding === 'octal' ? parseInt(textValue, 8) : textValue
}

/**
 * Gets the header's checksum sum.
 * The checksum field is considered as filled with spaces (ascii 32)
 *
 * @param {Buffer} tar
 * @param {number} offset - header offset
 *
 * @return {number}
 */
function getCheckSum(tar, offset)
{
	const checkSumStart = FIELDS['checksum'].offset
	const checkSumEnd   = FIELDS['checksum'].offset + FIELDS['checksum'].length - 1

	let sum = 0
	for (let i = 0; i < BLOCK_LENGTH; ++i)
		sum += i < checkSumStart || i > checkSumEnd ? tar[offset + i] : 32

	return sum
}

/**
 * Extracts archive to the destination
 *
 * @param {Buffer} tar
 * @param {string} destination - path to the destination folder
 *
 * @return {void}
 */
function extract(tar, destination)
{
	/** @type {TarHeader[]} */
	const headers = readHeaders(tar)

	let headerOffset = 0
	for (const header of headers) {
		const entryPath = join(destination, header.prefix, header.name)

		switch (header.typeflag) {
			case DIR_TYPE: // Create directory if it does not exist
				if (!existsSync(entryPath))
					mkdirSync(entryPath)
				break
			case FILE_TYPE: // Create/overwrite file
				const entryOffset = headerOffset + BLOCK_LENGTH
				const content     = tar.subarray(entryOffset, entryOffset + header.size)
				writeFileSync(entryPath, content)
				break
			default:
				throw new Error(`not supported entry typeflag: ${header.typeflag}`)
		}

		// Jump to the next header
		headerOffset += getOffsetDelta(header.size)
	}
}

/**
 * Creates and populates a tarball
 *
 * @param {string}       baseDir - parent dir of archived folder
 * @param {EntryStats[]} entryStats
 *
 * @return {Buffer}
 */
function create(baseDir, entryStats)
{
	const size = calculateTarSize(entryStats)
	const tar  = Buffer.alloc(size)

	let offset = 0
	for (const stat of entryStats) {
		setHeader(tar, offset, stat)

		if (stat.typeflag === FILE_TYPE) {
			const entryPath = join(baseDir, stat.prefix, stat.name)
			tar.set(readFileSync(entryPath), offset + BLOCK_LENGTH)
		}

		// Jump to the next header
		offset += getOffsetDelta(stat.size)
	}

	return tar
}

/**
 * Makes an empty tar with the required size
 *
 * @param {EntryStats[]} entryStats
 *
 * @return {number}
 */
function calculateTarSize(entryStats)
{
	let size = 2 * BLOCK_LENGTH // Two empty blocks at the end of the tarball
	for (const stat of entryStats)
		size += getOffsetDelta(stat.size)

	return size
}

/**
 * Sets a header to the tarball
 *
 * @param {Buffer}     tar
 * @param {number}     offset
 * @param {EntryStats} stats
 *
 * @return {void}
 */
function setHeader(tar, offset, stats)
{
	setAscii(tar, offset + FIELDS['name'    ].offset, stats.name.replaceAll('\\', '/'))
	setAscii(tar, offset + FIELDS['mode'    ].offset, '0000775')
	setAscii(tar, offset + FIELDS['uid'     ].offset, '0000000')
	setAscii(tar, offset + FIELDS['gid'     ].offset, '0000000')
	setOctal(tar, offset + FIELDS['size'    ].offset, stats.size, 11)
	setOctal(tar, offset + FIELDS['mtime'   ].offset, Math.round(stats.mtime/1000), 11)
	setAscii(tar, offset + FIELDS['checksum'].offset, '        ')
	setAscii(tar, offset + FIELDS['typeflag'].offset, stats.typeflag)
	setAscii(tar, offset + FIELDS['magic'   ].offset, 'ustar')
	setAscii(tar, offset + FIELDS['version' ].offset, '00')
	setAscii(tar, offset + FIELDS['devmajor'].offset, '0000000')
	setAscii(tar, offset + FIELDS['devminor'].offset, '0000000')
	setAscii(tar, offset + FIELDS['prefix'  ].offset, stats.prefix.replaceAll('\\', '/'))

	// Set final checksum
	const checksum = getCheckSum(tar, offset)
	setOctal(tar, offset + FIELDS['checksum'].offset, checksum, 6)
	tar.writeUInt8(0, offset + 154)
}

/**
 * Sets an octal value as 8bit ASCII
 *
 * @param {Buffer} tar
 * @param {number} offset
 * @param {number} val
 * @param {number} len
 */
function setOctal(tar, offset, val, len)
{
	const text = val.toString(8).padStart(len, '0')
	setAscii(tar, offset, text)
}

/**
 * Sets an ASCII text
 *
 * @param {Buffer} tar
 * @param {number} offset
 * @param {string} text
 */

function setAscii(tar, offset, text)
{
	for (let i = 0; i < text.length; ++i)
		tar.writeUInt8(text.charCodeAt(i), offset+i)
}

/**
 * Gets a list of all inner directories and files.
 *
 * @param {string} target - path to file or dir to be archived
 *
 * @return {string[]}
 */
function getEntryPaths(target)
{
	const stats = statSync(target)
	if (stats.isFile())
		return [basename(target)]

	const /** @type {string[]} */ entries = []
	readDirLoop(dirname(target), basename(target), entries)

	return entries
}

/**
 * Loops in the target directory and collects the entries
 *
 * @param {string} baseDir    - parent dir of the dir being archived
 * @param {string} currentDir - path to current dir
 * @param {string[]} acc      - list of all entry names
 *
 * @return {void}
 */
function readDirLoop(baseDir, currentDir, acc)
{
	const /** @type {string[]} */ innerDirs = []
	const /** @type {string[]} */ filePaths = []

	// Look inside current dir
	const /** @type {Dir}    */ dir = opendirSync(join(baseDir, currentDir))
	let   /** @type {Dirent} */ dirent
	while ((dirent = dir.readSync()) !== null) {
		if (dirent.isDirectory())
			innerDirs.push(dirent.name)
		else
			filePaths.push(join(currentDir, dirent.name))
	}
	dir.closeSync()

	// Add current dir
	acc.push(join(currentDir, sep))

	// Add the inner files
	filePaths.sort()
	for (const file of filePaths)
		acc.push(file)

	// Loop over the inner dirs
	innerDirs.sort()
	for (const innerDir of innerDirs)
		readDirLoop(baseDir, join(currentDir, innerDir), acc)
}

/**
 * Gets stats for the given entries
 *
 * @param {string}   baseDir - path to the parent directory
 * @param {string[]} entryPaths
 *
 * @return {EntryStats[]}
 */
function getEntryStats(baseDir, entryPaths)
{
	return entryPaths.map(path => {
		const entryPath      = join(baseDir, path)
		const stats          = statSync(entryPath)
		const {name, prefix} = getNamePrefix(path)
		const isDir          = entryPath.endsWith(sep)

		return {
			name    : name,
			typeflag: isDir ? DIR_TYPE : FILE_TYPE,
			size    : isDir ? 0 : stats.size,
			mtime   : stats.mtime.getTime(),
			prefix  : prefix,
		}
	})
}

/**
 * Splits long paths to name and prefix.
 *
 * @param {string} path
 *
 * @return {{name: string, prefix: string}}
 */
function getNamePrefix(path)
{
	if (path.length <= 100)
		return {name: path, prefix: ''}

	if (path.length > 255)
		throw new Error(`path is longer than 255 characters: ${path}`)

	const pathParts = path.split(sep)

	let /** @type {string} */ name   = ''
	let /** @type {string} */ prefix = ''

	for (let i = pathParts.length-1; i >= 0; --i) {
		let part = pathParts[i]

		if (name.length + part.length + 1 > 100) {
			prefix = pathParts.slice(0, i+1).join(sep)
			break
		}

		name = join(part, name)
	}

	if (name.length === 0 || name.length > 100 || prefix.length > 155)
		throw new Error(`cannot split the path to 100 + 155 characters: ${path}`)

	return {name, prefix}
}

module.exports = {
	create,
	createArchive,
	extract,
	extractArchive,
	getEntryPaths,
	getEntryStats,
	readHeaders,
}

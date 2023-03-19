'use strict'

const {join}  = require('node:path')
const {existsSync, mkdirSync, readFileSync, writeFileSync} = require('node:fs')

/**
 * @typedef {NodeModule}
 *
 * Wikipedia: tar (computing) : https://en.wikipedia.org/wiki/Tar_(computing)
 * GNU: Basic Tar Format: https://www.gnu.org/software/tar/manual/html_node/Standard.html
 * IBM zOS: tar - Format of tar archives: https://www.ibm.com/docs/en/zos/2.5.0?topic=formats-tar-format-tar-archives
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
 * @property {number} checksum - header check sum (Octal 12b as a null-terminated string)
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
 * @typedef {Object} TarHeaderField
 *
 * @property {string} name
 * @property {number} offset
 * @property {number} length
 * @property {string} encoding
 */

/** @type {TarHeaderField[]} */
const HEADER_FIELDS = [
	{name: 'name'    , offset:   0, length: 100, encoding: 'ascii'},
	{name: 'mode'    , offset: 100, length:   8, encoding: 'octal'},
	{name: 'uid'     , offset: 108, length:   8, encoding: 'octal'},
	{name: 'gid'     , offset: 116, length:   8, encoding: 'octal'},
	{name: 'size'    , offset: 124, length:  12, encoding: 'octal'},
	{name: 'mtime'   , offset: 136, length:  12, encoding: 'octal'},
	{name: 'checksum', offset: 148, length:   8, encoding: 'octal'},
	{name: 'typeflag', offset: 156, length:   1, encoding: 'ascii'},
	{name: 'linkname', offset: 157, length: 100, encoding: 'ascii'},
	{name: 'magic'   , offset: 257, length:   6, encoding: 'ascii'},
	{name: 'version' , offset: 263, length:   2, encoding: 'ascii'},
	{name: 'uname'   , offset: 265, length:  32, encoding: 'ascii'},
	{name: 'gname'   , offset: 297, length:  32, encoding: 'ascii'},
	{name: 'devmajor', offset: 329, length:   8, encoding: 'octal'},
	{name: 'devminor', offset: 337, length:   8, encoding: 'octal'},
	{name: 'prefix'  , offset: 345, length: 155, encoding: 'ascii'},
]

const BLOCK_LENGTH     = 512
const REG_TYPE         = '0'
const DIR_TYPE         = '5'
const CHECK_SUM_OFFSET = 148
const CHECK_SUM_LENGTH =   8

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

		if (header.typeflag !== REG_TYPE && header.typeflag !== DIR_TYPE)
			break // Reached the final empty block

		const checksum = getCheckSum(tar, offset)
		if (checksum !== header.checksum)
			throw new Error(`wrong checksum of: ${header.name}`)

		headers.push(header)

		// Jump to the next header
		offset += (Math.ceil(header.size / BLOCK_LENGTH) + 1) * BLOCK_LENGTH
	}

	return headers
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

	for (const /** @type {TarHeaderField} */ field of HEADER_FIELDS)
		header[field.name] = parseFiledValue(tar, offset, field)

	return header
}

/**
 * Parses a header field
 *
 * @param {Buffer}         tar
 * @param {number}         offset
 * @param {TarHeaderField} field
 *
 * @return {number|string}
 */
function parseFiledValue(tar, offset, field)
{
	const from = offset + field.offset
	let   to   = from
	while (tar[to] > 0 && to < from + field.length)
		to += 1

	const textValue = tar.subarray(from, to).toString()

	return field.encoding === 'octal' ? parseInt(textValue, 8) : textValue
}

/**
 * Gets the header's checksum sum
 *
 * @param {Buffer} tar
 * @param {number} offset
 *
 * @return {number}
 */
function getCheckSum(tar, offset)
{
	let sum = 0

	for (let i = 0; i < BLOCK_LENGTH; ++i) {
		sum += i >= CHECK_SUM_OFFSET && i < CHECK_SUM_OFFSET + CHECK_SUM_LENGTH
			? 32 // The checksum field is considered as filled with spaces (ascii 32)
			: tar[offset + i]
	}

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
			case REG_TYPE: // Create/overwrite file
				const entryOffset = headerOffset + BLOCK_LENGTH
				const content     = tar.subarray(entryOffset, entryOffset + header.size)
				writeFileSync(entryPath, content)
				break
			default:
				throw new Error(`not supported entry typeflag: ${header.typeflag}`)
		}

		// Jump to the next header
		headerOffset += (Math.ceil(header.size / BLOCK_LENGTH) + 1) * BLOCK_LENGTH
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
	const tar = makeBuffer(entryStats)

	let headerOffset = 0
	for (const stat of entryStats) {
		setHeader(tar, headerOffset, stat)

		if (stat.typeflag === REG_TYPE) {
			const entryPath = join(baseDir, stat.prefix, stat.name)
			tar.set(readFileSync(entryPath), headerOffset + BLOCK_LENGTH)
		}

		// Jump to the next header
		headerOffset += (Math.ceil(stat.size / BLOCK_LENGTH) + 1) * BLOCK_LENGTH
	}

	return tar
}

/**
 * Makes an empty tar with the required size
 *
 * @param {EntryStats[]} entryStats
 *
 * @return {Buffer}
 */
function makeBuffer(entryStats)
{
	let size = 2 * BLOCK_LENGTH // Two empty blocks at the end of the tarball
	for (const stat of entryStats)
		size += (Math.ceil(stat.size / BLOCK_LENGTH) + 1) * BLOCK_LENGTH

	return Buffer.alloc(size, 0, 'binary')
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
	// name
	setAscii(tar, offset, stats.name.replaceAll('\\', '/'))
	// mode
	setAscii(tar, offset + 100, '0000775')
	// uid
	setAscii(tar, offset + 108, '0001751')
	// gid
	setAscii(tar, offset + 116, '0001750')
	// size
	setOctal(tar, offset + 124, stats.size, 11)
	// mtime
	setOctal(tar, offset + 136, Math.round(stats.mtime/1000), 11)
	// typeflag
	setAscii(tar, offset + 156, stats.typeflag)
	// magic
	setAscii(tar, offset + 257, 'ustar')
	// version
	setAscii(tar, offset + 263, '00')
	// devmajor
	setAscii(tar, offset + 329, '0000000')
	// devminor
	setAscii(tar, offset + 337, '0000000')
	// prefix
	setAscii(tar, offset + 345, stats.prefix.replaceAll('\\', '/'))
	// checksum
	setOctal(tar, offset + 148, getCheckSum(tar, offset), 6)
	setAscii(tar, offset + 154, '\0 ')
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
	const text =  val.toString(8).padStart(len, '0')
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
		tar.writeInt8(text.charCodeAt(i), offset+i)
}

module.exports = {
	readHeaders,
	extract,
	create,
}

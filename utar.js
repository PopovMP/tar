'use strict'

/**
 * @typedef {Object} TarHeaderField
 *
 * @property {string} name
 * @property {number} offset
 * @property {number} length
 * @property {string} encoding
 */

/**
 * @typedef {Object} TarHeader
 *
 * @property {string} name
 * @property {number} mode
 * @property {number} uid
 * @property {number} gid
 * @property {number} size
 * @property {number} mTime
 * @property {number} checksum
 * @property {string} typeflag
 * @property {string} linkname
 * @property {string} magic
 * @property {string} version
 * @property {string} uname
 * @property {string} gname
 * @property {string} devmajor
 * @property {string} devminor
 * @property {string} prefix
 */

const {join}                                 = require('node:path')
const {existsSync, mkdirSync, writeFileSync} = require('node:fs')

/** @type {TarHeaderField[]} */
const HEADER_FIELDS = [
	{name: 'name'    , offset:   0, length: 100, encoding: 'ascii'},
	{name: 'mode'    , offset: 100, length:   8, encoding: 'octal'},
	{name: 'uid'     , offset: 108, length:   8, encoding: 'octal'},
	{name: 'gid'     , offset: 116, length:   8, encoding: 'octal'},
	{name: 'size'    , offset: 124, length:  12, encoding: 'octal'},
	{name: 'mTime'   , offset: 136, length:  12, encoding: 'octal'},
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
		const header = parseHeader(tar, offset)

		if (header.typeflag !== REG_TYPE && header.typeflag !== DIR_TYPE) break
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
	const header = {}

	for (const field of HEADER_FIELDS) {
		const name  = field.name
		const bytes = getBytes(tar, offset + field.offset, field.length)
		const value = parseFiled(field, bytes)
		if (typeof value === 'string' || typeof value === 'number')
			header[name] = value
	}

	return header
}

/**
 * Gets non-null bytes
 *
 * @param {Buffer} tar
 * @param {number} offset
 * @param {number} length
 *
 * @return {Buffer}
 */
function getBytes(tar, offset, length)
{
	let end = offset

	while (tar[end] !== 0)
		end += 1

	return tar.subarray(offset, end)
}

/**
 * Parses a header field
 *
 * @param {TarHeaderField} field
 * @param {Buffer}         bytes
 *
 * @return {number|string|undefined}
 */
function parseFiled(field, bytes)
{
	const textValue = bytes.toString()

	if (field.encoding === 'octal')
		return parseInt(textValue, 8)

	return textValue
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

	for (let i = 0; i < BLOCK_LENGTH; ++i)
		sum += i >= CHECK_SUM_OFFSET && i < CHECK_SUM_OFFSET + CHECK_SUM_LENGTH
			? 32 // The checksum field is considered as filled with spaces (ascii 32)
			: tar[offset + i]

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
function extractEntries(tar, destination)
{
	const headers = readHeaders(tar)

	let offset = 0
	for (const header of headers) {
		const entryPath = join(destination, header.name)

		if (header.typeflag === DIR_TYPE) {
			if (!existsSync(entryPath))
				mkdirSync(entryPath)
		}
		else if (header.typeflag === REG_TYPE) {
			const entryOffset = offset + BLOCK_LENGTH
			writeFileSync(entryPath, tar.subarray(entryOffset, entryOffset + header.size))
		}

		offset += (Math.ceil(header.size / BLOCK_LENGTH) + 1) * BLOCK_LENGTH
	}
}

module.exports = {
	readHeaders,
	extractEntries,
}

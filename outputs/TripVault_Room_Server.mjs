// @bun
var __defProp = Object.defineProperty;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// work/tripvault-room-server/entry.js
import { Database } from "bun:sqlite";
import { createHash, randomBytes as randomBytes2, randomInt, randomUUID } from "crypto";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";

// work/tripvault-room-server/node_modules/ethers/lib.esm/_version.js
var version = "6.17.0";

// work/tripvault-room-server/node_modules/ethers/lib.esm/utils/properties.js
function checkType(value, type, name) {
  const types = type.split("|").map((t) => t.trim());
  for (let i = 0;i < types.length; i++) {
    switch (type) {
      case "any":
        return;
      case "bigint":
      case "boolean":
      case "number":
      case "string":
        if (typeof value === type) {
          return;
        }
    }
  }
  const error = new Error(`invalid value for type ${type}`);
  error.code = "INVALID_ARGUMENT";
  error.argument = `value.${name}`;
  error.value = value;
  throw error;
}
function defineProperties(target, values, types) {
  for (let key in values) {
    let value = values[key];
    const type = types ? types[key] : null;
    if (type) {
      checkType(value, type, key);
    }
    Object.defineProperty(target, key, { enumerable: true, value, writable: false });
  }
}

// work/tripvault-room-server/node_modules/ethers/lib.esm/utils/errors.js
function stringify(value, seen) {
  if (value == null) {
    return "null";
  }
  if (seen == null) {
    seen = new Set;
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
  }
  if (Array.isArray(value)) {
    return "[ " + value.map((v) => stringify(v, seen)).join(", ") + " ]";
  }
  if (value instanceof Uint8Array) {
    const HEX = "0123456789abcdef";
    let result = "0x";
    for (let i = 0;i < value.length; i++) {
      result += HEX[value[i] >> 4];
      result += HEX[value[i] & 15];
    }
    return result;
  }
  if (typeof value === "object" && typeof value.toJSON === "function") {
    return stringify(value.toJSON(), seen);
  }
  switch (typeof value) {
    case "boolean":
    case "number":
    case "symbol":
      return value.toString();
    case "bigint":
      return BigInt(value).toString();
    case "string":
      return JSON.stringify(value);
    case "object": {
      const keys = Object.keys(value);
      keys.sort();
      return "{ " + keys.map((k) => `${stringify(k, seen)}: ${stringify(value[k], seen)}`).join(", ") + " }";
    }
  }
  return `[ COULD NOT SERIALIZE ]`;
}
function isError(error, code) {
  return error && error.code === code;
}
function makeError(message, code, info) {
  let shortMessage = message;
  {
    const details = [];
    if (info) {
      if ("message" in info || "code" in info || "name" in info) {
        throw new Error(`value will overwrite populated values: ${stringify(info)}`);
      }
      for (const key in info) {
        if (key === "shortMessage") {
          continue;
        }
        const value = info[key];
        details.push(key + "=" + stringify(value));
      }
    }
    details.push(`code=${code}`);
    details.push(`version=${version}`);
    if (details.length) {
      message += " (" + details.join(", ") + ")";
    }
  }
  let error;
  switch (code) {
    case "INVALID_ARGUMENT":
      error = new TypeError(message);
      break;
    case "NUMERIC_FAULT":
    case "BUFFER_OVERRUN":
      error = new RangeError(message);
      break;
    default:
      error = new Error(message);
  }
  defineProperties(error, { code });
  if (info) {
    Object.assign(error, info);
  }
  if (error.shortMessage == null) {
    defineProperties(error, { shortMessage });
  }
  return error;
}
function assert(check, message, code, info) {
  if (!check) {
    throw makeError(message, code, info);
  }
}
function assertArgument(check, message, name, value) {
  assert(check, message, "INVALID_ARGUMENT", { argument: name, value });
}
function assertArgumentCount(count, expectedCount, message) {
  if (message == null) {
    message = "";
  }
  if (message) {
    message = ": " + message;
  }
  assert(count >= expectedCount, "missing argument" + message, "MISSING_ARGUMENT", {
    count,
    expectedCount
  });
  assert(count <= expectedCount, "too many arguments" + message, "UNEXPECTED_ARGUMENT", {
    count,
    expectedCount
  });
}
var _normalizeForms = ["NFD", "NFC", "NFKD", "NFKC"].reduce((accum, form) => {
  try {
    if ("test".normalize(form) !== "test") {
      throw new Error("bad");
    }
    if (form === "NFD") {
      const check = String.fromCharCode(233).normalize("NFD");
      const expected = String.fromCharCode(101, 769);
      if (check !== expected) {
        throw new Error("broken");
      }
    }
    accum.push(form);
  } catch (error) {}
  return accum;
}, []);
function assertNormalize(form) {
  assert(_normalizeForms.indexOf(form) >= 0, "platform missing String.prototype.normalize", "UNSUPPORTED_OPERATION", {
    operation: "String.prototype.normalize",
    info: { form }
  });
}
function assertPrivate(givenGuard, guard, className) {
  if (className == null) {
    className = "";
  }
  if (givenGuard !== guard) {
    let method = className, operation = "new";
    if (className) {
      method += ".";
      operation += " " + className;
    }
    assert(false, `private constructor; use ${method}from* methods`, "UNSUPPORTED_OPERATION", {
      operation
    });
  }
}

// work/tripvault-room-server/node_modules/ethers/lib.esm/utils/data.js
function _getBytes(value, name, copy) {
  if (value instanceof Uint8Array) {
    if (copy) {
      return new Uint8Array(value);
    }
    return value;
  }
  if (typeof value === "string" && value.length % 2 === 0 && value.match(/^0x[0-9a-f]*$/i)) {
    const result = new Uint8Array((value.length - 2) / 2);
    let offset = 2;
    for (let i = 0;i < result.length; i++) {
      result[i] = parseInt(value.substring(offset, offset + 2), 16);
      offset += 2;
    }
    return result;
  }
  assertArgument(false, "invalid BytesLike value", name || "value", value);
}
function getBytes(value, name) {
  return _getBytes(value, name, false);
}
function getBytesCopy(value, name) {
  return _getBytes(value, name, true);
}
function isHexString(value, length) {
  if (typeof value !== "string" || !value.match(/^0x[0-9A-Fa-f]*$/)) {
    return false;
  }
  if (typeof length === "number" && value.length !== 2 + 2 * length) {
    return false;
  }
  if (length === true && value.length % 2 !== 0) {
    return false;
  }
  return true;
}
var HexCharacters = "0123456789abcdef";
function hexlify(data) {
  const bytes = getBytes(data);
  let result = "0x";
  for (let i = 0;i < bytes.length; i++) {
    const v = bytes[i];
    result += HexCharacters[(v & 240) >> 4] + HexCharacters[v & 15];
  }
  return result;
}
function concat(datas) {
  return "0x" + datas.map((d) => hexlify(d).substring(2)).join("");
}
function dataLength(data) {
  if (isHexString(data, true)) {
    return (data.length - 2) / 2;
  }
  return getBytes(data).length;
}
function dataSlice(data, start, end) {
  const bytes = getBytes(data);
  if (end != null && end > bytes.length) {
    assert(false, "cannot slice beyond data bounds", "BUFFER_OVERRUN", {
      buffer: bytes,
      length: bytes.length,
      offset: end
    });
  }
  return hexlify(bytes.slice(start == null ? 0 : start, end == null ? bytes.length : end));
}
function zeroPad(data, length, left) {
  const bytes = getBytes(data);
  assert(length >= bytes.length, "padding exceeds data length", "BUFFER_OVERRUN", {
    buffer: new Uint8Array(bytes),
    length,
    offset: length + 1
  });
  const result = new Uint8Array(length);
  result.fill(0);
  if (left) {
    result.set(bytes, length - bytes.length);
  } else {
    result.set(bytes, 0);
  }
  return hexlify(result);
}
function zeroPadValue(data, length) {
  return zeroPad(data, length, true);
}
function zeroPadBytes(data, length) {
  return zeroPad(data, length, false);
}

// work/tripvault-room-server/node_modules/ethers/lib.esm/utils/maths.js
var BN_0 = BigInt(0);
var BN_1 = BigInt(1);
var maxValue = 9007199254740991;
function fromTwos(_value, _width) {
  const value = getUint(_value, "value");
  const width = BigInt(getNumber(_width, "width"));
  assert(value >> width === BN_0, "overflow", "NUMERIC_FAULT", {
    operation: "fromTwos",
    fault: "overflow",
    value: _value
  });
  if (value >> width - BN_1) {
    const mask = (BN_1 << width) - BN_1;
    return -((~value & mask) + BN_1);
  }
  return value;
}
function toTwos(_value, _width) {
  let value = getBigInt(_value, "value");
  const width = BigInt(getNumber(_width, "width"));
  const limit = BN_1 << width - BN_1;
  if (value < BN_0) {
    value = -value;
    assert(value <= limit, "too low", "NUMERIC_FAULT", {
      operation: "toTwos",
      fault: "overflow",
      value: _value
    });
    const mask = (BN_1 << width) - BN_1;
    return (~value & mask) + BN_1;
  } else {
    assert(value < limit, "too high", "NUMERIC_FAULT", {
      operation: "toTwos",
      fault: "overflow",
      value: _value
    });
  }
  return value;
}
function mask(_value, _bits) {
  const value = getUint(_value, "value");
  const bits = BigInt(getNumber(_bits, "bits"));
  return value & (BN_1 << bits) - BN_1;
}
function getBigInt(value, name) {
  switch (typeof value) {
    case "bigint":
      return value;
    case "number":
      assertArgument(Number.isInteger(value), "underflow", name || "value", value);
      assertArgument(value >= -maxValue && value <= maxValue, "overflow", name || "value", value);
      return BigInt(value);
    case "string":
      try {
        if (value === "") {
          throw new Error("empty string");
        }
        if (value[0] === "-" && value[1] !== "-") {
          return -BigInt(value.substring(1));
        }
        return BigInt(value);
      } catch (e) {
        assertArgument(false, `invalid BigNumberish string: ${e.message}`, name || "value", value);
      }
  }
  assertArgument(false, "invalid BigNumberish value", name || "value", value);
}
function getUint(value, name) {
  const result = getBigInt(value, name);
  assert(result >= BN_0, "unsigned value cannot be negative", "NUMERIC_FAULT", {
    fault: "overflow",
    operation: "getUint",
    value
  });
  return result;
}
var Nibbles = "0123456789abcdef";
function toBigInt(value) {
  if (value instanceof Uint8Array) {
    let result = "0x0";
    for (const v of value) {
      result += Nibbles[v >> 4];
      result += Nibbles[v & 15];
    }
    return BigInt(result);
  }
  return getBigInt(value);
}
function getNumber(value, name) {
  switch (typeof value) {
    case "bigint":
      assertArgument(value >= -maxValue && value <= maxValue, "overflow", name || "value", value);
      return Number(value);
    case "number":
      assertArgument(Number.isInteger(value), "underflow", name || "value", value);
      assertArgument(value >= -maxValue && value <= maxValue, "overflow", name || "value", value);
      return value;
    case "string":
      try {
        if (value === "") {
          throw new Error("empty string");
        }
        return getNumber(BigInt(value), name);
      } catch (e) {
        assertArgument(false, `invalid numeric string: ${e.message}`, name || "value", value);
      }
  }
  assertArgument(false, "invalid numeric value", name || "value", value);
}
function toNumber(value) {
  return getNumber(toBigInt(value));
}
function toBeHex(_value, _width) {
  const value = getUint(_value, "value");
  let result = value.toString(16);
  if (_width == null) {
    if (result.length % 2) {
      result = "0" + result;
    }
  } else {
    const width = getNumber(_width, "width");
    if (width === 0 && value === BN_0) {
      return "0x";
    }
    assert(width * 2 >= result.length, `value exceeds width (${width} bytes)`, "NUMERIC_FAULT", {
      operation: "toBeHex",
      fault: "overflow",
      value: _value
    });
    while (result.length < width * 2) {
      result = "0" + result;
    }
  }
  return "0x" + result;
}
function toBeArray(_value, _width) {
  const value = getUint(_value, "value");
  if (value === BN_0) {
    const width = _width != null ? getNumber(_width, "width") : 0;
    return new Uint8Array(width);
  }
  let hex = value.toString(16);
  if (hex.length % 2) {
    hex = "0" + hex;
  }
  if (_width != null) {
    const width = getNumber(_width, "width");
    while (hex.length < width * 2) {
      hex = "00" + hex;
    }
    assert(width * 2 === hex.length, `value exceeds width (${width} bytes)`, "NUMERIC_FAULT", {
      operation: "toBeArray",
      fault: "overflow",
      value: _value
    });
  }
  const result = new Uint8Array(hex.length / 2);
  for (let i = 0;i < result.length; i++) {
    const offset = i * 2;
    result[i] = parseInt(hex.substring(offset, offset + 2), 16);
  }
  return result;
}
// work/tripvault-room-server/node_modules/ethers/lib.esm/utils/utf8.js
function errorFunc(reason, offset, bytes, output, badCodepoint) {
  assertArgument(false, `invalid codepoint at offset ${offset}; ${reason}`, "bytes", bytes);
}
function ignoreFunc(reason, offset, bytes, output, badCodepoint) {
  if (reason === "BAD_PREFIX" || reason === "UNEXPECTED_CONTINUE") {
    let i = 0;
    for (let o = offset + 1;o < bytes.length; o++) {
      if (bytes[o] >> 6 !== 2) {
        break;
      }
      i++;
    }
    return i;
  }
  if (reason === "OVERRUN") {
    return bytes.length - offset - 1;
  }
  return 0;
}
function replaceFunc(reason, offset, bytes, output, badCodepoint) {
  if (reason === "OVERLONG") {
    assertArgument(typeof badCodepoint === "number", "invalid bad code point for replacement", "badCodepoint", badCodepoint);
    output.push(badCodepoint);
    return 0;
  }
  output.push(65533);
  return ignoreFunc(reason, offset, bytes, output, badCodepoint);
}
var Utf8ErrorFuncs = Object.freeze({
  error: errorFunc,
  ignore: ignoreFunc,
  replace: replaceFunc
});
function getUtf8CodePoints(_bytes, onError) {
  if (onError == null) {
    onError = Utf8ErrorFuncs.error;
  }
  const bytes = getBytes(_bytes, "bytes");
  const result = [];
  let i = 0;
  while (i < bytes.length) {
    const c = bytes[i++];
    if (c >> 7 === 0) {
      result.push(c);
      continue;
    }
    let extraLength = null;
    let overlongMask = null;
    if ((c & 224) === 192) {
      extraLength = 1;
      overlongMask = 127;
    } else if ((c & 240) === 224) {
      extraLength = 2;
      overlongMask = 2047;
    } else if ((c & 248) === 240) {
      extraLength = 3;
      overlongMask = 65535;
    } else {
      if ((c & 192) === 128) {
        i += onError("UNEXPECTED_CONTINUE", i - 1, bytes, result);
      } else {
        i += onError("BAD_PREFIX", i - 1, bytes, result);
      }
      continue;
    }
    if (i - 1 + extraLength >= bytes.length) {
      i += onError("OVERRUN", i - 1, bytes, result);
      continue;
    }
    let res = c & (1 << 8 - extraLength - 1) - 1;
    for (let j = 0;j < extraLength; j++) {
      let nextChar = bytes[i];
      if ((nextChar & 192) != 128) {
        i += onError("MISSING_CONTINUE", i, bytes, result);
        res = null;
        break;
      }
      res = res << 6 | nextChar & 63;
      i++;
    }
    if (res === null) {
      continue;
    }
    if (res > 1114111) {
      i += onError("OUT_OF_RANGE", i - 1 - extraLength, bytes, result, res);
      continue;
    }
    if (res >= 55296 && res <= 57343) {
      i += onError("UTF16_SURROGATE", i - 1 - extraLength, bytes, result, res);
      continue;
    }
    if (res <= overlongMask) {
      i += onError("OVERLONG", i - 1 - extraLength, bytes, result, res);
      continue;
    }
    result.push(res);
  }
  return result;
}
function toUtf8Bytes(str, form) {
  assertArgument(typeof str === "string", "invalid string value", "str", str);
  if (form != null) {
    assertNormalize(form);
    str = str.normalize(form);
  }
  let result = [];
  for (let i = 0;i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 128) {
      result.push(c);
    } else if (c < 2048) {
      result.push(c >> 6 | 192);
      result.push(c & 63 | 128);
    } else if ((c & 64512) == 55296) {
      i++;
      const c2 = str.charCodeAt(i);
      assertArgument(i < str.length && (c2 & 64512) === 56320, "invalid surrogate pair", "str", str);
      const pair = 65536 + ((c & 1023) << 10) + (c2 & 1023);
      result.push(pair >> 18 | 240);
      result.push(pair >> 12 & 63 | 128);
      result.push(pair >> 6 & 63 | 128);
      result.push(pair & 63 | 128);
    } else {
      result.push(c >> 12 | 224);
      result.push(c >> 6 & 63 | 128);
      result.push(c & 63 | 128);
    }
  }
  return new Uint8Array(result);
}
function _toUtf8String(codePoints) {
  return codePoints.map((codePoint) => {
    if (codePoint <= 65535) {
      return String.fromCharCode(codePoint);
    }
    codePoint -= 65536;
    return String.fromCharCode((codePoint >> 10 & 1023) + 55296, (codePoint & 1023) + 56320);
  }).join("");
}
function toUtf8String(bytes, onError) {
  return _toUtf8String(getUtf8CodePoints(bytes, onError));
}
// work/tripvault-room-server/node_modules/ethers/lib.esm/abi/coders/abstract-coder.js
var WordSize = 32;
var Padding = new Uint8Array(WordSize);
var passProperties = ["then"];
var _guard = {};
var resultNames = new WeakMap;
function getNames(result) {
  return resultNames.get(result);
}
function setNames(result, names) {
  resultNames.set(result, names);
}
function throwError(name, error) {
  const wrapped = new Error(`deferred error during ABI decoding triggered accessing ${name}`);
  wrapped.error = error;
  throw wrapped;
}
function toObject(names, items, deep) {
  if (names.indexOf(null) >= 0) {
    return items.map((item, index) => {
      if (item instanceof Result) {
        return toObject(getNames(item), item, deep);
      }
      return item;
    });
  }
  return names.reduce((accum, name, index) => {
    let item = items.getValue(name);
    if (!(name in accum)) {
      if (deep && item instanceof Result) {
        item = toObject(getNames(item), item, deep);
      }
      accum[name] = item;
    }
    return accum;
  }, {});
}

class Result extends Array {
  #names;
  constructor(...args) {
    const guard = args[0];
    let items = args[1];
    let names = (args[2] || []).slice();
    let wrap = true;
    if (guard !== _guard) {
      items = args;
      names = [];
      wrap = false;
    }
    super(items.length);
    items.forEach((item, index) => {
      this[index] = item;
    });
    const nameCounts = names.reduce((accum, name) => {
      if (typeof name === "string") {
        accum.set(name, (accum.get(name) || 0) + 1);
      }
      return accum;
    }, new Map);
    setNames(this, Object.freeze(items.map((item, index) => {
      const name = names[index];
      if (name != null && nameCounts.get(name) === 1) {
        return name;
      }
      return null;
    })));
    this.#names = [];
    if (this.#names == null) {
      this.#names;
    }
    if (!wrap) {
      return;
    }
    Object.freeze(this);
    const proxy = new Proxy(this, {
      get: (target, prop, receiver) => {
        if (typeof prop === "string") {
          if (prop.match(/^[0-9]+$/)) {
            const index = getNumber(prop, "%index");
            if (index < 0 || index >= this.length) {
              throw new RangeError("out of result range");
            }
            const item = target[index];
            if (item instanceof Error) {
              throwError(`index ${index}`, item);
            }
            return item;
          }
          if (passProperties.indexOf(prop) >= 0) {
            return Reflect.get(target, prop, receiver);
          }
          const value = target[prop];
          if (value instanceof Function) {
            return function(...args) {
              return value.apply(this === receiver ? target : this, args);
            };
          } else if (!(prop in target)) {
            return target.getValue.apply(this === receiver ? target : this, [prop]);
          }
        }
        return Reflect.get(target, prop, receiver);
      }
    });
    setNames(proxy, getNames(this));
    return proxy;
  }
  toArray(deep) {
    const result = [];
    this.forEach((item, index) => {
      if (item instanceof Error) {
        throwError(`index ${index}`, item);
      }
      if (deep && item instanceof Result) {
        item = item.toArray(deep);
      }
      result.push(item);
    });
    return result;
  }
  toObject(deep) {
    const names = getNames(this);
    return names.reduce((accum, name, index) => {
      assert(name != null, `value at index ${index} unnamed`, "UNSUPPORTED_OPERATION", {
        operation: "toObject()"
      });
      return toObject(names, this, deep);
    }, {});
  }
  slice(start, end) {
    if (start == null) {
      start = 0;
    }
    if (start < 0) {
      start += this.length;
      if (start < 0) {
        start = 0;
      }
    }
    if (end == null) {
      end = this.length;
    }
    if (end < 0) {
      end += this.length;
      if (end < 0) {
        end = 0;
      }
    }
    if (end > this.length) {
      end = this.length;
    }
    const _names = getNames(this);
    const result = [], names = [];
    for (let i = start;i < end; i++) {
      result.push(this[i]);
      names.push(_names[i]);
    }
    return new Result(_guard, result, names);
  }
  filter(callback, thisArg) {
    const _names = getNames(this);
    const result = [], names = [];
    for (let i = 0;i < this.length; i++) {
      const item = this[i];
      if (item instanceof Error) {
        throwError(`index ${i}`, item);
      }
      if (callback.call(thisArg, item, i, this)) {
        result.push(item);
        names.push(_names[i]);
      }
    }
    return new Result(_guard, result, names);
  }
  map(callback, thisArg) {
    const result = [];
    for (let i = 0;i < this.length; i++) {
      const item = this[i];
      if (item instanceof Error) {
        throwError(`index ${i}`, item);
      }
      result.push(callback.call(thisArg, item, i, this));
    }
    return result;
  }
  getValue(name) {
    const index = getNames(this).indexOf(name);
    if (index === -1) {
      return;
    }
    const value = this[index];
    if (value instanceof Error) {
      throwError(`property ${JSON.stringify(name)}`, value.error);
    }
    return value;
  }
  static fromItems(items, keys) {
    return new Result(_guard, items, keys);
  }
}
function getValue(value) {
  let bytes = toBeArray(value);
  assert(bytes.length <= WordSize, "value out-of-bounds", "BUFFER_OVERRUN", { buffer: bytes, length: WordSize, offset: bytes.length });
  if (bytes.length !== WordSize) {
    bytes = getBytesCopy(concat([Padding.slice(bytes.length % WordSize), bytes]));
  }
  return bytes;
}

class Coder {
  name;
  type;
  localName;
  dynamic;
  constructor(name, type, localName, dynamic) {
    defineProperties(this, { name, type, localName, dynamic }, {
      name: "string",
      type: "string",
      localName: "string",
      dynamic: "boolean"
    });
  }
  _throwError(message, value) {
    assertArgument(false, message, this.localName, value);
  }
}

class Writer {
  #data;
  #dataLength;
  constructor() {
    this.#data = [];
    this.#dataLength = 0;
  }
  get data() {
    return concat(this.#data);
  }
  get length() {
    return this.#dataLength;
  }
  #writeData(data) {
    this.#data.push(data);
    this.#dataLength += data.length;
    return data.length;
  }
  appendWriter(writer) {
    return this.#writeData(getBytesCopy(writer.data));
  }
  writeBytes(value) {
    let bytes = getBytesCopy(value);
    const paddingOffset = bytes.length % WordSize;
    if (paddingOffset) {
      bytes = getBytesCopy(concat([bytes, Padding.slice(paddingOffset)]));
    }
    return this.#writeData(bytes);
  }
  writeValue(value) {
    return this.#writeData(getValue(value));
  }
  writeUpdatableValue() {
    const offset = this.#data.length;
    this.#data.push(Padding);
    this.#dataLength += WordSize;
    return (value) => {
      this.#data[offset] = getValue(value);
    };
  }
}

class Reader {
  allowLoose;
  #data;
  #offset;
  #bytesRead;
  #parent;
  #maxInflation;
  constructor(data, allowLoose, maxInflation) {
    defineProperties(this, { allowLoose: !!allowLoose });
    this.#data = getBytesCopy(data);
    this.#bytesRead = 0;
    this.#parent = null;
    this.#maxInflation = maxInflation != null ? maxInflation : 1024;
    this.#offset = 0;
  }
  get data() {
    return hexlify(this.#data);
  }
  get dataLength() {
    return this.#data.length;
  }
  get consumed() {
    return this.#offset;
  }
  get bytes() {
    return new Uint8Array(this.#data);
  }
  #incrementBytesRead(count) {
    if (this.#parent) {
      return this.#parent.#incrementBytesRead(count);
    }
    this.#bytesRead += count;
    assert(this.#maxInflation < 1 || this.#bytesRead <= this.#maxInflation * this.dataLength, `compressed ABI data exceeds inflation ratio of ${this.#maxInflation} ( see: https://github.com/ethers-io/ethers.js/issues/4537 )`, "BUFFER_OVERRUN", {
      buffer: getBytesCopy(this.#data),
      offset: this.#offset,
      length: count,
      info: {
        bytesRead: this.#bytesRead,
        dataLength: this.dataLength
      }
    });
  }
  #peekBytes(offset, length, loose) {
    let alignedLength = Math.ceil(length / WordSize) * WordSize;
    if (this.#offset + alignedLength > this.#data.length) {
      if (this.allowLoose && loose && this.#offset + length <= this.#data.length) {
        alignedLength = length;
      } else {
        assert(false, "data out-of-bounds", "BUFFER_OVERRUN", {
          buffer: getBytesCopy(this.#data),
          length: this.#data.length,
          offset: this.#offset + alignedLength
        });
      }
    }
    return this.#data.slice(this.#offset, this.#offset + alignedLength);
  }
  subReader(offset) {
    const reader = new Reader(this.#data.slice(this.#offset + offset), this.allowLoose, this.#maxInflation);
    reader.#parent = this;
    return reader;
  }
  readBytes(length, loose) {
    let bytes = this.#peekBytes(0, length, !!loose);
    this.#incrementBytesRead(length);
    this.#offset += bytes.length;
    return bytes.slice(0, length);
  }
  readValue() {
    return toBigInt(this.readBytes(WordSize));
  }
  readIndex() {
    return toNumber(this.readBytes(WordSize));
  }
}

// work/tripvault-room-server/node_modules/@noble/hashes/esm/_assert.js
function number(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error(`Wrong positive integer: ${n}`);
}
function bytes(b, ...lengths) {
  if (!(b instanceof Uint8Array))
    throw new Error("Expected Uint8Array");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error(`Expected Uint8Array of length ${lengths}, not of length=${b.length}`);
}
function hash(hash) {
  if (typeof hash !== "function" || typeof hash.create !== "function")
    throw new Error("Hash should be wrapped by utils.wrapConstructor");
  number(hash.outputLen);
  number(hash.blockLen);
}
function exists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function output(out, instance) {
  bytes(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error(`digestInto() expects output buffer of length at least ${min}`);
  }
}

// work/tripvault-room-server/node_modules/@noble/hashes/esm/_u64.js
var U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
var _32n = /* @__PURE__ */ BigInt(32);
function fromBig(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
  return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
function split(lst, le = false) {
  let Ah = new Uint32Array(lst.length);
  let Al = new Uint32Array(lst.length);
  for (let i = 0;i < lst.length; i++) {
    const { h, l } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
var rotlSH = (h, l, s) => h << s | l >>> 32 - s;
var rotlSL = (h, l, s) => l << s | h >>> 32 - s;
var rotlBH = (h, l, s) => l << s - 32 | h >>> 64 - s;
var rotlBL = (h, l, s) => h << s - 32 | l >>> 64 - s;

// work/tripvault-room-server/node_modules/@noble/hashes/esm/cryptoNode.js
import * as nc from "crypto";
var crypto = nc && typeof nc === "object" && "webcrypto" in nc ? nc.webcrypto : undefined;

// work/tripvault-room-server/node_modules/@noble/hashes/esm/utils.js
/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var u8a = (a) => a instanceof Uint8Array;
var u32 = (arr) => new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
var createView = (arr) => new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
var rotr = (word, shift) => word << 32 - shift | word >>> shift;
var isLE = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
if (!isLE)
  throw new Error("Non little-endian hardware is not supported");
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
  return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes(data) {
  if (typeof data === "string")
    data = utf8ToBytes(data);
  if (!u8a(data))
    throw new Error(`expected Uint8Array, got ${typeof data}`);
  return data;
}
function concatBytes(...arrays) {
  const r = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0));
  let pad = 0;
  arrays.forEach((a) => {
    if (!u8a(a))
      throw new Error("Uint8Array expected");
    r.set(a, pad);
    pad += a.length;
  });
  return r;
}

class Hash {
  clone() {
    return this._cloneInto();
  }
}
var toStr = {}.toString;
function wrapConstructor(hashCons) {
  const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}
function wrapXOFConstructorWithOpts(hashCons) {
  const hashC = (msg, opts) => hashCons(opts).update(toBytes(msg)).digest();
  const tmp = hashCons({});
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = (opts) => hashCons(opts);
  return hashC;
}
function randomBytes(bytesLength = 32) {
  if (crypto && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(new Uint8Array(bytesLength));
  }
  throw new Error("crypto.getRandomValues must be defined");
}

// work/tripvault-room-server/node_modules/@noble/hashes/esm/sha3.js
var [SHA3_PI, SHA3_ROTL, _SHA3_IOTA] = [[], [], []];
var _0n = /* @__PURE__ */ BigInt(0);
var _1n = /* @__PURE__ */ BigInt(1);
var _2n = /* @__PURE__ */ BigInt(2);
var _7n = /* @__PURE__ */ BigInt(7);
var _256n = /* @__PURE__ */ BigInt(256);
var _0x71n = /* @__PURE__ */ BigInt(113);
for (let round = 0, R = _1n, x = 1, y = 0;round < 24; round++) {
  [x, y] = [y, (2 * x + 3 * y) % 5];
  SHA3_PI.push(2 * (5 * y + x));
  SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
  let t = _0n;
  for (let j = 0;j < 7; j++) {
    R = (R << _1n ^ (R >> _7n) * _0x71n) % _256n;
    if (R & _2n)
      t ^= _1n << (_1n << /* @__PURE__ */ BigInt(j)) - _1n;
  }
  _SHA3_IOTA.push(t);
}
var [SHA3_IOTA_H, SHA3_IOTA_L] = /* @__PURE__ */ split(_SHA3_IOTA, true);
var rotlH = (h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
var rotlL = (h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
function keccakP(s, rounds = 24) {
  const B = new Uint32Array(5 * 2);
  for (let round = 24 - rounds;round < 24; round++) {
    for (let x = 0;x < 10; x++)
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0;x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0;y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    let curH = s[2];
    let curL = s[3];
    for (let t = 0;t < 24; t++) {
      const shift = SHA3_ROTL[t];
      const Th = rotlH(curH, curL, shift);
      const Tl = rotlL(curH, curL, shift);
      const PI = SHA3_PI[t];
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    for (let y = 0;y < 50; y += 10) {
      for (let x = 0;x < 10; x++)
        B[x] = s[y + x];
      for (let x = 0;x < 10; x++)
        s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
    }
    s[0] ^= SHA3_IOTA_H[round];
    s[1] ^= SHA3_IOTA_L[round];
  }
  B.fill(0);
}

class Keccak extends Hash {
  constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
    super();
    this.blockLen = blockLen;
    this.suffix = suffix;
    this.outputLen = outputLen;
    this.enableXOF = enableXOF;
    this.rounds = rounds;
    this.pos = 0;
    this.posOut = 0;
    this.finished = false;
    this.destroyed = false;
    number(outputLen);
    if (0 >= this.blockLen || this.blockLen >= 200)
      throw new Error("Sha3 supports only keccak-f1600 function");
    this.state = new Uint8Array(200);
    this.state32 = u32(this.state);
  }
  keccak() {
    keccakP(this.state32, this.rounds);
    this.posOut = 0;
    this.pos = 0;
  }
  update(data) {
    exists(this);
    const { blockLen, state } = this;
    data = toBytes(data);
    const len = data.length;
    for (let pos = 0;pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      for (let i = 0;i < take; i++)
        state[this.pos++] ^= data[pos++];
      if (this.pos === blockLen)
        this.keccak();
    }
    return this;
  }
  finish() {
    if (this.finished)
      return;
    this.finished = true;
    const { state, suffix, pos, blockLen } = this;
    state[pos] ^= suffix;
    if ((suffix & 128) !== 0 && pos === blockLen - 1)
      this.keccak();
    state[blockLen - 1] ^= 128;
    this.keccak();
  }
  writeInto(out) {
    exists(this, false);
    bytes(out);
    this.finish();
    const bufferOut = this.state;
    const { blockLen } = this;
    for (let pos = 0, len = out.length;pos < len; ) {
      if (this.posOut >= blockLen)
        this.keccak();
      const take = Math.min(blockLen - this.posOut, len - pos);
      out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
      this.posOut += take;
      pos += take;
    }
    return out;
  }
  xofInto(out) {
    if (!this.enableXOF)
      throw new Error("XOF is not possible for this instance");
    return this.writeInto(out);
  }
  xof(bytes) {
    number(bytes);
    return this.xofInto(new Uint8Array(bytes));
  }
  digestInto(out) {
    output(out, this);
    if (this.finished)
      throw new Error("digest() was already called");
    this.writeInto(out);
    this.destroy();
    return out;
  }
  digest() {
    return this.digestInto(new Uint8Array(this.outputLen));
  }
  destroy() {
    this.destroyed = true;
    this.state.fill(0);
  }
  _cloneInto(to) {
    const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
    to || (to = new Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
    to.state32.set(this.state32);
    to.pos = this.pos;
    to.posOut = this.posOut;
    to.finished = this.finished;
    to.rounds = rounds;
    to.suffix = suffix;
    to.outputLen = outputLen;
    to.enableXOF = enableXOF;
    to.destroyed = this.destroyed;
    return to;
  }
}
var gen = (suffix, blockLen, outputLen) => wrapConstructor(() => new Keccak(blockLen, suffix, outputLen));
var sha3_224 = /* @__PURE__ */ gen(6, 144, 224 / 8);
var sha3_256 = /* @__PURE__ */ gen(6, 136, 256 / 8);
var sha3_384 = /* @__PURE__ */ gen(6, 104, 384 / 8);
var sha3_512 = /* @__PURE__ */ gen(6, 72, 512 / 8);
var keccak_224 = /* @__PURE__ */ gen(1, 144, 224 / 8);
var keccak_256 = /* @__PURE__ */ gen(1, 136, 256 / 8);
var keccak_384 = /* @__PURE__ */ gen(1, 104, 384 / 8);
var keccak_512 = /* @__PURE__ */ gen(1, 72, 512 / 8);
var genShake = (suffix, blockLen, outputLen) => wrapXOFConstructorWithOpts((opts = {}) => new Keccak(blockLen, suffix, opts.dkLen === undefined ? outputLen : opts.dkLen, true));
var shake128 = /* @__PURE__ */ genShake(31, 168, 128 / 8);
var shake256 = /* @__PURE__ */ genShake(31, 136, 256 / 8);

// work/tripvault-room-server/node_modules/ethers/lib.esm/crypto/keccak.js
var locked = false;
var _keccak256 = function(data) {
  return keccak_256(data);
};
var __keccak256 = _keccak256;
function keccak256(_data) {
  const data = getBytes(_data, "data");
  return hexlify(__keccak256(data));
}
keccak256._ = _keccak256;
keccak256.lock = function() {
  locked = true;
};
keccak256.register = function(func) {
  if (locked) {
    throw new TypeError("keccak256 is locked");
  }
  __keccak256 = func;
};
Object.freeze(keccak256);

// work/tripvault-room-server/node_modules/@noble/hashes/esm/_sha2.js
function setBigUint64(view, byteOffset, value, isLE) {
  if (typeof view.setBigUint64 === "function")
    return view.setBigUint64(byteOffset, value, isLE);
  const _32n = BigInt(32);
  const _u32_max = BigInt(4294967295);
  const wh = Number(value >> _32n & _u32_max);
  const wl = Number(value & _u32_max);
  const h = isLE ? 4 : 0;
  const l = isLE ? 0 : 4;
  view.setUint32(byteOffset + h, wh, isLE);
  view.setUint32(byteOffset + l, wl, isLE);
}

class SHA2 extends Hash {
  constructor(blockLen, outputLen, padOffset, isLE) {
    super();
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE;
    this.finished = false;
    this.length = 0;
    this.pos = 0;
    this.destroyed = false;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    exists(this);
    const { view, buffer, blockLen } = this;
    data = toBytes(data);
    const len = data.length;
    for (let pos = 0;pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (;blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    exists(this);
    output(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    this.buffer.subarray(pos).fill(0);
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos;i < blockLen; i++)
      buffer[i] = 0;
    setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE);
    this.process(view, 0);
    const oview = createView(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen should be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0;i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to || (to = new this.constructor);
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.length = length;
    to.pos = pos;
    to.finished = finished;
    to.destroyed = destroyed;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
}

// work/tripvault-room-server/node_modules/@noble/hashes/esm/sha256.js
var Chi = (a, b, c) => a & b ^ ~a & c;
var Maj = (a, b, c) => a & b ^ a & c ^ b & c;
var SHA256_K = /* @__PURE__ */ new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var IV = /* @__PURE__ */ new Uint32Array([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);

class SHA256 extends SHA2 {
  constructor() {
    super(64, 32, 8, false);
    this.A = IV[0] | 0;
    this.B = IV[1] | 0;
    this.C = IV[2] | 0;
    this.D = IV[3] | 0;
    this.E = IV[4] | 0;
    this.F = IV[5] | 0;
    this.G = IV[6] | 0;
    this.H = IV[7] | 0;
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i = 0;i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16;i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0;i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    SHA256_W.fill(0);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    this.buffer.fill(0);
  }
}
var sha256 = /* @__PURE__ */ wrapConstructor(() => new SHA256);

// work/tripvault-room-server/node_modules/@noble/hashes/esm/hmac.js
class HMAC extends Hash {
  constructor(hash2, _key) {
    super();
    this.finished = false;
    this.destroyed = false;
    hash(hash2);
    const key = toBytes(_key);
    this.iHash = hash2.create();
    if (typeof this.iHash.update !== "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    pad.set(key.length > blockLen ? hash2.create().update(key).digest() : key);
    for (let i = 0;i < pad.length; i++)
      pad[i] ^= 54;
    this.iHash.update(pad);
    this.oHash = hash2.create();
    for (let i = 0;i < pad.length; i++)
      pad[i] ^= 54 ^ 92;
    this.oHash.update(pad);
    pad.fill(0);
  }
  update(buf) {
    exists(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    exists(this);
    bytes(out, this.outputLen);
    this.finished = true;
    this.iHash.digestInto(out);
    this.oHash.update(out);
    this.oHash.digestInto(out);
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.oHash.outputLen);
    this.digestInto(out);
    return out;
  }
  _cloneInto(to) {
    to || (to = Object.create(Object.getPrototypeOf(this), {}));
    const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
    to = to;
    to.finished = finished;
    to.destroyed = destroyed;
    to.blockLen = blockLen;
    to.outputLen = outputLen;
    to.oHash = oHash._cloneInto(to.oHash);
    to.iHash = iHash._cloneInto(to.iHash);
    return to;
  }
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
}
var hmac = (hash, key, message) => new HMAC(hash, key).update(message).digest();
hmac.create = (hash, key) => new HMAC(hash, key);

// work/tripvault-room-server/node_modules/@noble/curves/esm/abstract/utils.js
var exports_utils = {};
__export(exports_utils, {
  bitGet: () => bitGet,
  bitLen: () => bitLen,
  bitMask: () => bitMask,
  bitSet: () => bitSet,
  bytesToHex: () => bytesToHex,
  bytesToNumberBE: () => bytesToNumberBE,
  bytesToNumberLE: () => bytesToNumberLE,
  concatBytes: () => concatBytes2,
  createHmacDrbg: () => createHmacDrbg,
  ensureBytes: () => ensureBytes,
  equalBytes: () => equalBytes,
  hexToBytes: () => hexToBytes,
  hexToNumber: () => hexToNumber,
  numberToBytesBE: () => numberToBytesBE,
  numberToBytesLE: () => numberToBytesLE,
  numberToHexUnpadded: () => numberToHexUnpadded,
  numberToVarBytesBE: () => numberToVarBytesBE,
  utf8ToBytes: () => utf8ToBytes2,
  validateObject: () => validateObject
});
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n2 = BigInt(0);
var _1n2 = BigInt(1);
var _2n2 = BigInt(2);
var u8a2 = (a) => a instanceof Uint8Array;
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function bytesToHex(bytes) {
  if (!u8a2(bytes))
    throw new Error("Uint8Array expected");
  let hex = "";
  for (let i = 0;i < bytes.length; i++) {
    hex += hexes[bytes[i]];
  }
  return hex;
}
function numberToHexUnpadded(num) {
  const hex = num.toString(16);
  return hex.length & 1 ? `0${hex}` : hex;
}
function hexToNumber(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  return BigInt(hex === "" ? "0" : `0x${hex}`);
}
function hexToBytes(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  const len = hex.length;
  if (len % 2)
    throw new Error("padded hex string expected, got unpadded hex of length " + len);
  const array = new Uint8Array(len / 2);
  for (let i = 0;i < array.length; i++) {
    const j = i * 2;
    const hexByte = hex.slice(j, j + 2);
    const byte = Number.parseInt(hexByte, 16);
    if (Number.isNaN(byte) || byte < 0)
      throw new Error("Invalid byte sequence");
    array[i] = byte;
  }
  return array;
}
function bytesToNumberBE(bytes) {
  return hexToNumber(bytesToHex(bytes));
}
function bytesToNumberLE(bytes) {
  if (!u8a2(bytes))
    throw new Error("Uint8Array expected");
  return hexToNumber(bytesToHex(Uint8Array.from(bytes).reverse()));
}
function numberToBytesBE(n, len) {
  return hexToBytes(n.toString(16).padStart(len * 2, "0"));
}
function numberToBytesLE(n, len) {
  return numberToBytesBE(n, len).reverse();
}
function numberToVarBytesBE(n) {
  return hexToBytes(numberToHexUnpadded(n));
}
function ensureBytes(title, hex, expectedLength) {
  let res;
  if (typeof hex === "string") {
    try {
      res = hexToBytes(hex);
    } catch (e) {
      throw new Error(`${title} must be valid hex string, got "${hex}". Cause: ${e}`);
    }
  } else if (u8a2(hex)) {
    res = Uint8Array.from(hex);
  } else {
    throw new Error(`${title} must be hex string or Uint8Array`);
  }
  const len = res.length;
  if (typeof expectedLength === "number" && len !== expectedLength)
    throw new Error(`${title} expected ${expectedLength} bytes, got ${len}`);
  return res;
}
function concatBytes2(...arrays) {
  const r = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0));
  let pad = 0;
  arrays.forEach((a) => {
    if (!u8a2(a))
      throw new Error("Uint8Array expected");
    r.set(a, pad);
    pad += a.length;
  });
  return r;
}
function equalBytes(b1, b2) {
  if (b1.length !== b2.length)
    return false;
  for (let i = 0;i < b1.length; i++)
    if (b1[i] !== b2[i])
      return false;
  return true;
}
function utf8ToBytes2(str) {
  if (typeof str !== "string")
    throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
  return new Uint8Array(new TextEncoder().encode(str));
}
function bitLen(n) {
  let len;
  for (len = 0;n > _0n2; n >>= _1n2, len += 1)
    ;
  return len;
}
function bitGet(n, pos) {
  return n >> BigInt(pos) & _1n2;
}
var bitSet = (n, pos, value) => {
  return n | (value ? _1n2 : _0n2) << BigInt(pos);
};
var bitMask = (n) => (_2n2 << BigInt(n - 1)) - _1n2;
var u8n = (data) => new Uint8Array(data);
var u8fr = (arr) => Uint8Array.from(arr);
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
  if (typeof hashLen !== "number" || hashLen < 2)
    throw new Error("hashLen must be a number");
  if (typeof qByteLen !== "number" || qByteLen < 2)
    throw new Error("qByteLen must be a number");
  if (typeof hmacFn !== "function")
    throw new Error("hmacFn must be a function");
  let v = u8n(hashLen);
  let k = u8n(hashLen);
  let i = 0;
  const reset = () => {
    v.fill(1);
    k.fill(0);
    i = 0;
  };
  const h = (...b) => hmacFn(k, v, ...b);
  const reseed = (seed = u8n()) => {
    k = h(u8fr([0]), seed);
    v = h();
    if (seed.length === 0)
      return;
    k = h(u8fr([1]), seed);
    v = h();
  };
  const gen = () => {
    if (i++ >= 1000)
      throw new Error("drbg: tried 1000 values");
    let len = 0;
    const out = [];
    while (len < qByteLen) {
      v = h();
      const sl = v.slice();
      out.push(sl);
      len += v.length;
    }
    return concatBytes2(...out);
  };
  const genUntil = (seed, pred) => {
    reset();
    reseed(seed);
    let res = undefined;
    while (!(res = pred(gen())))
      reseed();
    reset();
    return res;
  };
  return genUntil;
}
var validatorFns = {
  bigint: (val) => typeof val === "bigint",
  function: (val) => typeof val === "function",
  boolean: (val) => typeof val === "boolean",
  string: (val) => typeof val === "string",
  stringOrUint8Array: (val) => typeof val === "string" || val instanceof Uint8Array,
  isSafeInteger: (val) => Number.isSafeInteger(val),
  array: (val) => Array.isArray(val),
  field: (val, object) => object.Fp.isValid(val),
  hash: (val) => typeof val === "function" && Number.isSafeInteger(val.outputLen)
};
function validateObject(object, validators, optValidators = {}) {
  const checkField = (fieldName, type, isOptional) => {
    const checkVal = validatorFns[type];
    if (typeof checkVal !== "function")
      throw new Error(`Invalid validator "${type}", expected function`);
    const val = object[fieldName];
    if (isOptional && val === undefined)
      return;
    if (!checkVal(val, object)) {
      throw new Error(`Invalid param ${String(fieldName)}=${val} (${typeof val}), expected ${type}`);
    }
  };
  for (const [fieldName, type] of Object.entries(validators))
    checkField(fieldName, type, false);
  for (const [fieldName, type] of Object.entries(optValidators))
    checkField(fieldName, type, true);
  return object;
}

// work/tripvault-room-server/node_modules/@noble/curves/esm/abstract/modular.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n3 = BigInt(0);
var _1n3 = BigInt(1);
var _2n3 = BigInt(2);
var _3n = BigInt(3);
var _4n = BigInt(4);
var _5n = BigInt(5);
var _8n = BigInt(8);
var _9n = BigInt(9);
var _16n = BigInt(16);
function mod(a, b) {
  const result = a % b;
  return result >= _0n3 ? result : b + result;
}
function pow(num, power, modulo) {
  if (modulo <= _0n3 || power < _0n3)
    throw new Error("Expected power/modulo > 0");
  if (modulo === _1n3)
    return _0n3;
  let res = _1n3;
  while (power > _0n3) {
    if (power & _1n3)
      res = res * num % modulo;
    num = num * num % modulo;
    power >>= _1n3;
  }
  return res;
}
function pow2(x, power, modulo) {
  let res = x;
  while (power-- > _0n3) {
    res *= res;
    res %= modulo;
  }
  return res;
}
function invert(number, modulo) {
  if (number === _0n3 || modulo <= _0n3) {
    throw new Error(`invert: expected positive integers, got n=${number} mod=${modulo}`);
  }
  let a = mod(number, modulo);
  let b = modulo;
  let x = _0n3, y = _1n3, u = _1n3, v = _0n3;
  while (a !== _0n3) {
    const q = b / a;
    const r = b % a;
    const m = x - u * q;
    const n = y - v * q;
    b = a, a = r, x = u, y = v, u = m, v = n;
  }
  const gcd = b;
  if (gcd !== _1n3)
    throw new Error("invert: does not exist");
  return mod(x, modulo);
}
function tonelliShanks(P) {
  const legendreC = (P - _1n3) / _2n3;
  let Q, S, Z;
  for (Q = P - _1n3, S = 0;Q % _2n3 === _0n3; Q /= _2n3, S++)
    ;
  for (Z = _2n3;Z < P && pow(Z, legendreC, P) !== P - _1n3; Z++)
    ;
  if (S === 1) {
    const p1div4 = (P + _1n3) / _4n;
    return function tonelliFast(Fp, n) {
      const root = Fp.pow(n, p1div4);
      if (!Fp.eql(Fp.sqr(root), n))
        throw new Error("Cannot find square root");
      return root;
    };
  }
  const Q1div2 = (Q + _1n3) / _2n3;
  return function tonelliSlow(Fp, n) {
    if (Fp.pow(n, legendreC) === Fp.neg(Fp.ONE))
      throw new Error("Cannot find square root");
    let r = S;
    let g = Fp.pow(Fp.mul(Fp.ONE, Z), Q);
    let x = Fp.pow(n, Q1div2);
    let b = Fp.pow(n, Q);
    while (!Fp.eql(b, Fp.ONE)) {
      if (Fp.eql(b, Fp.ZERO))
        return Fp.ZERO;
      let m = 1;
      for (let t2 = Fp.sqr(b);m < r; m++) {
        if (Fp.eql(t2, Fp.ONE))
          break;
        t2 = Fp.sqr(t2);
      }
      const ge = Fp.pow(g, _1n3 << BigInt(r - m - 1));
      g = Fp.sqr(ge);
      x = Fp.mul(x, ge);
      b = Fp.mul(b, g);
      r = m;
    }
    return x;
  };
}
function FpSqrt(P) {
  if (P % _4n === _3n) {
    const p1div4 = (P + _1n3) / _4n;
    return function sqrt3mod4(Fp, n) {
      const root = Fp.pow(n, p1div4);
      if (!Fp.eql(Fp.sqr(root), n))
        throw new Error("Cannot find square root");
      return root;
    };
  }
  if (P % _8n === _5n) {
    const c1 = (P - _5n) / _8n;
    return function sqrt5mod8(Fp, n) {
      const n2 = Fp.mul(n, _2n3);
      const v = Fp.pow(n2, c1);
      const nv = Fp.mul(n, v);
      const i = Fp.mul(Fp.mul(nv, _2n3), v);
      const root = Fp.mul(nv, Fp.sub(i, Fp.ONE));
      if (!Fp.eql(Fp.sqr(root), n))
        throw new Error("Cannot find square root");
      return root;
    };
  }
  if (P % _16n === _9n) {}
  return tonelliShanks(P);
}
var FIELD_FIELDS = [
  "create",
  "isValid",
  "is0",
  "neg",
  "inv",
  "sqrt",
  "sqr",
  "eql",
  "add",
  "sub",
  "mul",
  "pow",
  "div",
  "addN",
  "subN",
  "mulN",
  "sqrN"
];
function validateField(field) {
  const initial = {
    ORDER: "bigint",
    MASK: "bigint",
    BYTES: "isSafeInteger",
    BITS: "isSafeInteger"
  };
  const opts = FIELD_FIELDS.reduce((map, val) => {
    map[val] = "function";
    return map;
  }, initial);
  return validateObject(field, opts);
}
function FpPow(f, num, power) {
  if (power < _0n3)
    throw new Error("Expected power > 0");
  if (power === _0n3)
    return f.ONE;
  if (power === _1n3)
    return num;
  let p = f.ONE;
  let d = num;
  while (power > _0n3) {
    if (power & _1n3)
      p = f.mul(p, d);
    d = f.sqr(d);
    power >>= _1n3;
  }
  return p;
}
function FpInvertBatch(f, nums) {
  const tmp = new Array(nums.length);
  const lastMultiplied = nums.reduce((acc, num, i) => {
    if (f.is0(num))
      return acc;
    tmp[i] = acc;
    return f.mul(acc, num);
  }, f.ONE);
  const inverted = f.inv(lastMultiplied);
  nums.reduceRight((acc, num, i) => {
    if (f.is0(num))
      return acc;
    tmp[i] = f.mul(acc, tmp[i]);
    return f.mul(acc, num);
  }, inverted);
  return tmp;
}
function nLength(n, nBitLength) {
  const _nBitLength = nBitLength !== undefined ? nBitLength : n.toString(2).length;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
function Field(ORDER, bitLen, isLE = false, redef = {}) {
  if (ORDER <= _0n3)
    throw new Error(`Expected Field ORDER > 0, got ${ORDER}`);
  const { nBitLength: BITS, nByteLength: BYTES } = nLength(ORDER, bitLen);
  if (BYTES > 2048)
    throw new Error("Field lengths over 2048 bytes are not supported");
  const sqrtP = FpSqrt(ORDER);
  const f = Object.freeze({
    ORDER,
    BITS,
    BYTES,
    MASK: bitMask(BITS),
    ZERO: _0n3,
    ONE: _1n3,
    create: (num) => mod(num, ORDER),
    isValid: (num) => {
      if (typeof num !== "bigint")
        throw new Error(`Invalid field element: expected bigint, got ${typeof num}`);
      return _0n3 <= num && num < ORDER;
    },
    is0: (num) => num === _0n3,
    isOdd: (num) => (num & _1n3) === _1n3,
    neg: (num) => mod(-num, ORDER),
    eql: (lhs, rhs) => lhs === rhs,
    sqr: (num) => mod(num * num, ORDER),
    add: (lhs, rhs) => mod(lhs + rhs, ORDER),
    sub: (lhs, rhs) => mod(lhs - rhs, ORDER),
    mul: (lhs, rhs) => mod(lhs * rhs, ORDER),
    pow: (num, power) => FpPow(f, num, power),
    div: (lhs, rhs) => mod(lhs * invert(rhs, ORDER), ORDER),
    sqrN: (num) => num * num,
    addN: (lhs, rhs) => lhs + rhs,
    subN: (lhs, rhs) => lhs - rhs,
    mulN: (lhs, rhs) => lhs * rhs,
    inv: (num) => invert(num, ORDER),
    sqrt: redef.sqrt || ((n) => sqrtP(f, n)),
    invertBatch: (lst) => FpInvertBatch(f, lst),
    cmov: (a, b, c) => c ? b : a,
    toBytes: (num) => isLE ? numberToBytesLE(num, BYTES) : numberToBytesBE(num, BYTES),
    fromBytes: (bytes) => {
      if (bytes.length !== BYTES)
        throw new Error(`Fp.fromBytes: expected ${BYTES}, got ${bytes.length}`);
      return isLE ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
    }
  });
  return Object.freeze(f);
}
function getFieldBytesLength(fieldOrder) {
  if (typeof fieldOrder !== "bigint")
    throw new Error("field order must be bigint");
  const bitLength = fieldOrder.toString(2).length;
  return Math.ceil(bitLength / 8);
}
function getMinHashLength(fieldOrder) {
  const length = getFieldBytesLength(fieldOrder);
  return length + Math.ceil(length / 2);
}
function mapHashToField(key, fieldOrder, isLE = false) {
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = getMinHashLength(fieldOrder);
  if (len < 16 || len < minLen || len > 1024)
    throw new Error(`expected ${minLen}-1024 bytes of input, got ${len}`);
  const num = isLE ? bytesToNumberBE(key) : bytesToNumberLE(key);
  const reduced = mod(num, fieldOrder - _1n3) + _1n3;
  return isLE ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}

// work/tripvault-room-server/node_modules/@noble/curves/esm/abstract/curve.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n4 = BigInt(0);
var _1n4 = BigInt(1);
function wNAF(c, bits) {
  const constTimeNegate = (condition, item) => {
    const neg = item.negate();
    return condition ? neg : item;
  };
  const opts = (W) => {
    const windows = Math.ceil(bits / W) + 1;
    const windowSize = 2 ** (W - 1);
    return { windows, windowSize };
  };
  return {
    constTimeNegate,
    unsafeLadder(elm, n) {
      let p = c.ZERO;
      let d = elm;
      while (n > _0n4) {
        if (n & _1n4)
          p = p.add(d);
        d = d.double();
        n >>= _1n4;
      }
      return p;
    },
    precomputeWindow(elm, W) {
      const { windows, windowSize } = opts(W);
      const points = [];
      let p = elm;
      let base = p;
      for (let window = 0;window < windows; window++) {
        base = p;
        points.push(base);
        for (let i = 1;i < windowSize; i++) {
          base = base.add(p);
          points.push(base);
        }
        p = base.double();
      }
      return points;
    },
    wNAF(W, precomputes, n) {
      const { windows, windowSize } = opts(W);
      let p = c.ZERO;
      let f = c.BASE;
      const mask = BigInt(2 ** W - 1);
      const maxNumber = 2 ** W;
      const shiftBy = BigInt(W);
      for (let window = 0;window < windows; window++) {
        const offset = window * windowSize;
        let wbits = Number(n & mask);
        n >>= shiftBy;
        if (wbits > windowSize) {
          wbits -= maxNumber;
          n += _1n4;
        }
        const offset1 = offset;
        const offset2 = offset + Math.abs(wbits) - 1;
        const cond1 = window % 2 !== 0;
        const cond2 = wbits < 0;
        if (wbits === 0) {
          f = f.add(constTimeNegate(cond1, precomputes[offset1]));
        } else {
          p = p.add(constTimeNegate(cond2, precomputes[offset2]));
        }
      }
      return { p, f };
    },
    wNAFCached(P, precomputesMap, n, transform) {
      const W = P._WINDOW_SIZE || 1;
      let comp = precomputesMap.get(P);
      if (!comp) {
        comp = this.precomputeWindow(P, W);
        if (W !== 1) {
          precomputesMap.set(P, transform(comp));
        }
      }
      return this.wNAF(W, comp, n);
    }
  };
}
function validateBasic(curve) {
  validateField(curve.Fp);
  validateObject(curve, {
    n: "bigint",
    h: "bigint",
    Gx: "field",
    Gy: "field"
  }, {
    nBitLength: "isSafeInteger",
    nByteLength: "isSafeInteger"
  });
  return Object.freeze({
    ...nLength(curve.n, curve.nBitLength),
    ...curve,
    ...{ p: curve.Fp.ORDER }
  });
}

// work/tripvault-room-server/node_modules/@noble/curves/esm/abstract/weierstrass.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function validatePointOpts(curve) {
  const opts = validateBasic(curve);
  validateObject(opts, {
    a: "field",
    b: "field"
  }, {
    allowedPrivateKeyLengths: "array",
    wrapPrivateKey: "boolean",
    isTorsionFree: "function",
    clearCofactor: "function",
    allowInfinityPoint: "boolean",
    fromBytes: "function",
    toBytes: "function"
  });
  const { endo, Fp, a } = opts;
  if (endo) {
    if (!Fp.eql(a, Fp.ZERO)) {
      throw new Error("Endomorphism can only be defined for Koblitz curves that have a=0");
    }
    if (typeof endo !== "object" || typeof endo.beta !== "bigint" || typeof endo.splitScalar !== "function") {
      throw new Error("Expected endomorphism with beta: bigint and splitScalar: function");
    }
  }
  return Object.freeze({ ...opts });
}
var { bytesToNumberBE: b2n, hexToBytes: h2b } = exports_utils;
var DER = {
  Err: class DERErr extends Error {
    constructor(m = "") {
      super(m);
    }
  },
  _parseInt(data) {
    const { Err: E } = DER;
    if (data.length < 2 || data[0] !== 2)
      throw new E("Invalid signature integer tag");
    const len = data[1];
    const res = data.subarray(2, len + 2);
    if (!len || res.length !== len)
      throw new E("Invalid signature integer: wrong length");
    if (res[0] & 128)
      throw new E("Invalid signature integer: negative");
    if (res[0] === 0 && !(res[1] & 128))
      throw new E("Invalid signature integer: unnecessary leading zero");
    return { d: b2n(res), l: data.subarray(len + 2) };
  },
  toSig(hex) {
    const { Err: E } = DER;
    const data = typeof hex === "string" ? h2b(hex) : hex;
    if (!(data instanceof Uint8Array))
      throw new Error("ui8a expected");
    let l = data.length;
    if (l < 2 || data[0] != 48)
      throw new E("Invalid signature tag");
    if (data[1] !== l - 2)
      throw new E("Invalid signature: incorrect length");
    const { d: r, l: sBytes } = DER._parseInt(data.subarray(2));
    const { d: s, l: rBytesLeft } = DER._parseInt(sBytes);
    if (rBytesLeft.length)
      throw new E("Invalid signature: left bytes after parsing");
    return { r, s };
  },
  hexFromSig(sig) {
    const slice = (s) => Number.parseInt(s[0], 16) & 8 ? "00" + s : s;
    const h = (num) => {
      const hex = num.toString(16);
      return hex.length & 1 ? `0${hex}` : hex;
    };
    const s = slice(h(sig.s));
    const r = slice(h(sig.r));
    const shl = s.length / 2;
    const rhl = r.length / 2;
    const sl = h(shl);
    const rl = h(rhl);
    return `30${h(rhl + shl + 4)}02${rl}${r}02${sl}${s}`;
  }
};
var _0n5 = BigInt(0);
var _1n5 = BigInt(1);
var _2n4 = BigInt(2);
var _3n2 = BigInt(3);
var _4n2 = BigInt(4);
function weierstrassPoints(opts) {
  const CURVE = validatePointOpts(opts);
  const { Fp } = CURVE;
  const toBytes = CURVE.toBytes || ((_c, point, _isCompressed) => {
    const a = point.toAffine();
    return concatBytes2(Uint8Array.from([4]), Fp.toBytes(a.x), Fp.toBytes(a.y));
  });
  const fromBytes = CURVE.fromBytes || ((bytes) => {
    const tail = bytes.subarray(1);
    const x = Fp.fromBytes(tail.subarray(0, Fp.BYTES));
    const y = Fp.fromBytes(tail.subarray(Fp.BYTES, 2 * Fp.BYTES));
    return { x, y };
  });
  function weierstrassEquation(x) {
    const { a, b } = CURVE;
    const x2 = Fp.sqr(x);
    const x3 = Fp.mul(x2, x);
    return Fp.add(Fp.add(x3, Fp.mul(x, a)), b);
  }
  if (!Fp.eql(Fp.sqr(CURVE.Gy), weierstrassEquation(CURVE.Gx)))
    throw new Error("bad generator point: equation left != right");
  function isWithinCurveOrder(num) {
    return typeof num === "bigint" && _0n5 < num && num < CURVE.n;
  }
  function assertGE(num) {
    if (!isWithinCurveOrder(num))
      throw new Error("Expected valid bigint: 0 < bigint < curve.n");
  }
  function normPrivateKeyToScalar(key) {
    const { allowedPrivateKeyLengths: lengths, nByteLength, wrapPrivateKey, n } = CURVE;
    if (lengths && typeof key !== "bigint") {
      if (key instanceof Uint8Array)
        key = bytesToHex(key);
      if (typeof key !== "string" || !lengths.includes(key.length))
        throw new Error("Invalid key");
      key = key.padStart(nByteLength * 2, "0");
    }
    let num;
    try {
      num = typeof key === "bigint" ? key : bytesToNumberBE(ensureBytes("private key", key, nByteLength));
    } catch (error) {
      throw new Error(`private key must be ${nByteLength} bytes, hex or bigint, not ${typeof key}`);
    }
    if (wrapPrivateKey)
      num = mod(num, n);
    assertGE(num);
    return num;
  }
  const pointPrecomputes = new Map;
  function assertPrjPoint(other) {
    if (!(other instanceof Point))
      throw new Error("ProjectivePoint expected");
  }

  class Point {
    constructor(px, py, pz) {
      this.px = px;
      this.py = py;
      this.pz = pz;
      if (px == null || !Fp.isValid(px))
        throw new Error("x required");
      if (py == null || !Fp.isValid(py))
        throw new Error("y required");
      if (pz == null || !Fp.isValid(pz))
        throw new Error("z required");
    }
    static fromAffine(p) {
      const { x, y } = p || {};
      if (!p || !Fp.isValid(x) || !Fp.isValid(y))
        throw new Error("invalid affine point");
      if (p instanceof Point)
        throw new Error("projective point not allowed");
      const is0 = (i) => Fp.eql(i, Fp.ZERO);
      if (is0(x) && is0(y))
        return Point.ZERO;
      return new Point(x, y, Fp.ONE);
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    static normalizeZ(points) {
      const toInv = Fp.invertBatch(points.map((p) => p.pz));
      return points.map((p, i) => p.toAffine(toInv[i])).map(Point.fromAffine);
    }
    static fromHex(hex) {
      const P = Point.fromAffine(fromBytes(ensureBytes("pointHex", hex)));
      P.assertValidity();
      return P;
    }
    static fromPrivateKey(privateKey) {
      return Point.BASE.multiply(normPrivateKeyToScalar(privateKey));
    }
    _setWindowSize(windowSize) {
      this._WINDOW_SIZE = windowSize;
      pointPrecomputes.delete(this);
    }
    assertValidity() {
      if (this.is0()) {
        if (CURVE.allowInfinityPoint && !Fp.is0(this.py))
          return;
        throw new Error("bad point: ZERO");
      }
      const { x, y } = this.toAffine();
      if (!Fp.isValid(x) || !Fp.isValid(y))
        throw new Error("bad point: x or y not FE");
      const left = Fp.sqr(y);
      const right = weierstrassEquation(x);
      if (!Fp.eql(left, right))
        throw new Error("bad point: equation left != right");
      if (!this.isTorsionFree())
        throw new Error("bad point: not in prime-order subgroup");
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (Fp.isOdd)
        return !Fp.isOdd(y);
      throw new Error("Field doesn't support isOdd");
    }
    equals(other) {
      assertPrjPoint(other);
      const { px: X1, py: Y1, pz: Z1 } = this;
      const { px: X2, py: Y2, pz: Z2 } = other;
      const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
      const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
      return U1 && U2;
    }
    negate() {
      return new Point(this.px, Fp.neg(this.py), this.pz);
    }
    double() {
      const { a, b } = CURVE;
      const b3 = Fp.mul(b, _3n2);
      const { px: X1, py: Y1, pz: Z1 } = this;
      let { ZERO: X3, ZERO: Y3, ZERO: Z3 } = Fp;
      let t0 = Fp.mul(X1, X1);
      let t1 = Fp.mul(Y1, Y1);
      let t2 = Fp.mul(Z1, Z1);
      let t3 = Fp.mul(X1, Y1);
      t3 = Fp.add(t3, t3);
      Z3 = Fp.mul(X1, Z1);
      Z3 = Fp.add(Z3, Z3);
      X3 = Fp.mul(a, Z3);
      Y3 = Fp.mul(b3, t2);
      Y3 = Fp.add(X3, Y3);
      X3 = Fp.sub(t1, Y3);
      Y3 = Fp.add(t1, Y3);
      Y3 = Fp.mul(X3, Y3);
      X3 = Fp.mul(t3, X3);
      Z3 = Fp.mul(b3, Z3);
      t2 = Fp.mul(a, t2);
      t3 = Fp.sub(t0, t2);
      t3 = Fp.mul(a, t3);
      t3 = Fp.add(t3, Z3);
      Z3 = Fp.add(t0, t0);
      t0 = Fp.add(Z3, t0);
      t0 = Fp.add(t0, t2);
      t0 = Fp.mul(t0, t3);
      Y3 = Fp.add(Y3, t0);
      t2 = Fp.mul(Y1, Z1);
      t2 = Fp.add(t2, t2);
      t0 = Fp.mul(t2, t3);
      X3 = Fp.sub(X3, t0);
      Z3 = Fp.mul(t2, t1);
      Z3 = Fp.add(Z3, Z3);
      Z3 = Fp.add(Z3, Z3);
      return new Point(X3, Y3, Z3);
    }
    add(other) {
      assertPrjPoint(other);
      const { px: X1, py: Y1, pz: Z1 } = this;
      const { px: X2, py: Y2, pz: Z2 } = other;
      let { ZERO: X3, ZERO: Y3, ZERO: Z3 } = Fp;
      const a = CURVE.a;
      const b3 = Fp.mul(CURVE.b, _3n2);
      let t0 = Fp.mul(X1, X2);
      let t1 = Fp.mul(Y1, Y2);
      let t2 = Fp.mul(Z1, Z2);
      let t3 = Fp.add(X1, Y1);
      let t4 = Fp.add(X2, Y2);
      t3 = Fp.mul(t3, t4);
      t4 = Fp.add(t0, t1);
      t3 = Fp.sub(t3, t4);
      t4 = Fp.add(X1, Z1);
      let t5 = Fp.add(X2, Z2);
      t4 = Fp.mul(t4, t5);
      t5 = Fp.add(t0, t2);
      t4 = Fp.sub(t4, t5);
      t5 = Fp.add(Y1, Z1);
      X3 = Fp.add(Y2, Z2);
      t5 = Fp.mul(t5, X3);
      X3 = Fp.add(t1, t2);
      t5 = Fp.sub(t5, X3);
      Z3 = Fp.mul(a, t4);
      X3 = Fp.mul(b3, t2);
      Z3 = Fp.add(X3, Z3);
      X3 = Fp.sub(t1, Z3);
      Z3 = Fp.add(t1, Z3);
      Y3 = Fp.mul(X3, Z3);
      t1 = Fp.add(t0, t0);
      t1 = Fp.add(t1, t0);
      t2 = Fp.mul(a, t2);
      t4 = Fp.mul(b3, t4);
      t1 = Fp.add(t1, t2);
      t2 = Fp.sub(t0, t2);
      t2 = Fp.mul(a, t2);
      t4 = Fp.add(t4, t2);
      t0 = Fp.mul(t1, t4);
      Y3 = Fp.add(Y3, t0);
      t0 = Fp.mul(t5, t4);
      X3 = Fp.mul(t3, X3);
      X3 = Fp.sub(X3, t0);
      t0 = Fp.mul(t3, t1);
      Z3 = Fp.mul(t5, Z3);
      Z3 = Fp.add(Z3, t0);
      return new Point(X3, Y3, Z3);
    }
    subtract(other) {
      return this.add(other.negate());
    }
    is0() {
      return this.equals(Point.ZERO);
    }
    wNAF(n) {
      return wnaf.wNAFCached(this, pointPrecomputes, n, (comp) => {
        const toInv = Fp.invertBatch(comp.map((p) => p.pz));
        return comp.map((p, i) => p.toAffine(toInv[i])).map(Point.fromAffine);
      });
    }
    multiplyUnsafe(n) {
      const I = Point.ZERO;
      if (n === _0n5)
        return I;
      assertGE(n);
      if (n === _1n5)
        return this;
      const { endo } = CURVE;
      if (!endo)
        return wnaf.unsafeLadder(this, n);
      let { k1neg, k1, k2neg, k2 } = endo.splitScalar(n);
      let k1p = I;
      let k2p = I;
      let d = this;
      while (k1 > _0n5 || k2 > _0n5) {
        if (k1 & _1n5)
          k1p = k1p.add(d);
        if (k2 & _1n5)
          k2p = k2p.add(d);
        d = d.double();
        k1 >>= _1n5;
        k2 >>= _1n5;
      }
      if (k1neg)
        k1p = k1p.negate();
      if (k2neg)
        k2p = k2p.negate();
      k2p = new Point(Fp.mul(k2p.px, endo.beta), k2p.py, k2p.pz);
      return k1p.add(k2p);
    }
    multiply(scalar) {
      assertGE(scalar);
      let n = scalar;
      let point, fake;
      const { endo } = CURVE;
      if (endo) {
        const { k1neg, k1, k2neg, k2 } = endo.splitScalar(n);
        let { p: k1p, f: f1p } = this.wNAF(k1);
        let { p: k2p, f: f2p } = this.wNAF(k2);
        k1p = wnaf.constTimeNegate(k1neg, k1p);
        k2p = wnaf.constTimeNegate(k2neg, k2p);
        k2p = new Point(Fp.mul(k2p.px, endo.beta), k2p.py, k2p.pz);
        point = k1p.add(k2p);
        fake = f1p.add(f2p);
      } else {
        const { p, f } = this.wNAF(n);
        point = p;
        fake = f;
      }
      return Point.normalizeZ([point, fake])[0];
    }
    multiplyAndAddUnsafe(Q, a, b) {
      const G = Point.BASE;
      const mul = (P, a) => a === _0n5 || a === _1n5 || !P.equals(G) ? P.multiplyUnsafe(a) : P.multiply(a);
      const sum = mul(this, a).add(mul(Q, b));
      return sum.is0() ? undefined : sum;
    }
    toAffine(iz) {
      const { px: x, py: y, pz: z } = this;
      const is0 = this.is0();
      if (iz == null)
        iz = is0 ? Fp.ONE : Fp.inv(z);
      const ax = Fp.mul(x, iz);
      const ay = Fp.mul(y, iz);
      const zz = Fp.mul(z, iz);
      if (is0)
        return { x: Fp.ZERO, y: Fp.ZERO };
      if (!Fp.eql(zz, Fp.ONE))
        throw new Error("invZ was invalid");
      return { x: ax, y: ay };
    }
    isTorsionFree() {
      const { h: cofactor, isTorsionFree } = CURVE;
      if (cofactor === _1n5)
        return true;
      if (isTorsionFree)
        return isTorsionFree(Point, this);
      throw new Error("isTorsionFree() has not been declared for the elliptic curve");
    }
    clearCofactor() {
      const { h: cofactor, clearCofactor } = CURVE;
      if (cofactor === _1n5)
        return this;
      if (clearCofactor)
        return clearCofactor(Point, this);
      return this.multiplyUnsafe(CURVE.h);
    }
    toRawBytes(isCompressed = true) {
      this.assertValidity();
      return toBytes(Point, this, isCompressed);
    }
    toHex(isCompressed = true) {
      return bytesToHex(this.toRawBytes(isCompressed));
    }
  }
  Point.BASE = new Point(CURVE.Gx, CURVE.Gy, Fp.ONE);
  Point.ZERO = new Point(Fp.ZERO, Fp.ONE, Fp.ZERO);
  const _bits = CURVE.nBitLength;
  const wnaf = wNAF(Point, CURVE.endo ? Math.ceil(_bits / 2) : _bits);
  return {
    CURVE,
    ProjectivePoint: Point,
    normPrivateKeyToScalar,
    weierstrassEquation,
    isWithinCurveOrder
  };
}
function validateOpts(curve) {
  const opts = validateBasic(curve);
  validateObject(opts, {
    hash: "hash",
    hmac: "function",
    randomBytes: "function"
  }, {
    bits2int: "function",
    bits2int_modN: "function",
    lowS: "boolean"
  });
  return Object.freeze({ lowS: true, ...opts });
}
function weierstrass(curveDef) {
  const CURVE = validateOpts(curveDef);
  const { Fp, n: CURVE_ORDER } = CURVE;
  const compressedLen = Fp.BYTES + 1;
  const uncompressedLen = 2 * Fp.BYTES + 1;
  function isValidFieldElement(num) {
    return _0n5 < num && num < Fp.ORDER;
  }
  function modN(a) {
    return mod(a, CURVE_ORDER);
  }
  function invN(a) {
    return invert(a, CURVE_ORDER);
  }
  const { ProjectivePoint: Point, normPrivateKeyToScalar, weierstrassEquation, isWithinCurveOrder } = weierstrassPoints({
    ...CURVE,
    toBytes(_c, point, isCompressed) {
      const a = point.toAffine();
      const x = Fp.toBytes(a.x);
      const cat = concatBytes2;
      if (isCompressed) {
        return cat(Uint8Array.from([point.hasEvenY() ? 2 : 3]), x);
      } else {
        return cat(Uint8Array.from([4]), x, Fp.toBytes(a.y));
      }
    },
    fromBytes(bytes) {
      const len = bytes.length;
      const head = bytes[0];
      const tail = bytes.subarray(1);
      if (len === compressedLen && (head === 2 || head === 3)) {
        const x = bytesToNumberBE(tail);
        if (!isValidFieldElement(x))
          throw new Error("Point is not on curve");
        const y2 = weierstrassEquation(x);
        let y = Fp.sqrt(y2);
        const isYOdd = (y & _1n5) === _1n5;
        const isHeadOdd = (head & 1) === 1;
        if (isHeadOdd !== isYOdd)
          y = Fp.neg(y);
        return { x, y };
      } else if (len === uncompressedLen && head === 4) {
        const x = Fp.fromBytes(tail.subarray(0, Fp.BYTES));
        const y = Fp.fromBytes(tail.subarray(Fp.BYTES, 2 * Fp.BYTES));
        return { x, y };
      } else {
        throw new Error(`Point of length ${len} was invalid. Expected ${compressedLen} compressed bytes or ${uncompressedLen} uncompressed bytes`);
      }
    }
  });
  const numToNByteStr = (num) => bytesToHex(numberToBytesBE(num, CURVE.nByteLength));
  function isBiggerThanHalfOrder(number) {
    const HALF = CURVE_ORDER >> _1n5;
    return number > HALF;
  }
  function normalizeS(s) {
    return isBiggerThanHalfOrder(s) ? modN(-s) : s;
  }
  const slcNum = (b, from, to) => bytesToNumberBE(b.slice(from, to));

  class Signature {
    constructor(r, s, recovery) {
      this.r = r;
      this.s = s;
      this.recovery = recovery;
      this.assertValidity();
    }
    static fromCompact(hex) {
      const l = CURVE.nByteLength;
      hex = ensureBytes("compactSignature", hex, l * 2);
      return new Signature(slcNum(hex, 0, l), slcNum(hex, l, 2 * l));
    }
    static fromDER(hex) {
      const { r, s } = DER.toSig(ensureBytes("DER", hex));
      return new Signature(r, s);
    }
    assertValidity() {
      if (!isWithinCurveOrder(this.r))
        throw new Error("r must be 0 < r < CURVE.n");
      if (!isWithinCurveOrder(this.s))
        throw new Error("s must be 0 < s < CURVE.n");
    }
    addRecoveryBit(recovery) {
      return new Signature(this.r, this.s, recovery);
    }
    recoverPublicKey(msgHash) {
      const { r, s, recovery: rec } = this;
      const h = bits2int_modN(ensureBytes("msgHash", msgHash));
      if (rec == null || ![0, 1, 2, 3].includes(rec))
        throw new Error("recovery id invalid");
      const radj = rec === 2 || rec === 3 ? r + CURVE.n : r;
      if (radj >= Fp.ORDER)
        throw new Error("recovery id 2 or 3 invalid");
      const prefix = (rec & 1) === 0 ? "02" : "03";
      const R = Point.fromHex(prefix + numToNByteStr(radj));
      const ir = invN(radj);
      const u1 = modN(-h * ir);
      const u2 = modN(s * ir);
      const Q = Point.BASE.multiplyAndAddUnsafe(R, u1, u2);
      if (!Q)
        throw new Error("point at infinify");
      Q.assertValidity();
      return Q;
    }
    hasHighS() {
      return isBiggerThanHalfOrder(this.s);
    }
    normalizeS() {
      return this.hasHighS() ? new Signature(this.r, modN(-this.s), this.recovery) : this;
    }
    toDERRawBytes() {
      return hexToBytes(this.toDERHex());
    }
    toDERHex() {
      return DER.hexFromSig({ r: this.r, s: this.s });
    }
    toCompactRawBytes() {
      return hexToBytes(this.toCompactHex());
    }
    toCompactHex() {
      return numToNByteStr(this.r) + numToNByteStr(this.s);
    }
  }
  const utils = {
    isValidPrivateKey(privateKey) {
      try {
        normPrivateKeyToScalar(privateKey);
        return true;
      } catch (error) {
        return false;
      }
    },
    normPrivateKeyToScalar,
    randomPrivateKey: () => {
      const length = getMinHashLength(CURVE.n);
      return mapHashToField(CURVE.randomBytes(length), CURVE.n);
    },
    precompute(windowSize = 8, point = Point.BASE) {
      point._setWindowSize(windowSize);
      point.multiply(BigInt(3));
      return point;
    }
  };
  function getPublicKey(privateKey, isCompressed = true) {
    return Point.fromPrivateKey(privateKey).toRawBytes(isCompressed);
  }
  function isProbPub(item) {
    const arr = item instanceof Uint8Array;
    const str = typeof item === "string";
    const len = (arr || str) && item.length;
    if (arr)
      return len === compressedLen || len === uncompressedLen;
    if (str)
      return len === 2 * compressedLen || len === 2 * uncompressedLen;
    if (item instanceof Point)
      return true;
    return false;
  }
  function getSharedSecret(privateA, publicB, isCompressed = true) {
    if (isProbPub(privateA))
      throw new Error("first arg must be private key");
    if (!isProbPub(publicB))
      throw new Error("second arg must be public key");
    const b = Point.fromHex(publicB);
    return b.multiply(normPrivateKeyToScalar(privateA)).toRawBytes(isCompressed);
  }
  const bits2int = CURVE.bits2int || function(bytes) {
    const num = bytesToNumberBE(bytes);
    const delta = bytes.length * 8 - CURVE.nBitLength;
    return delta > 0 ? num >> BigInt(delta) : num;
  };
  const bits2int_modN = CURVE.bits2int_modN || function(bytes) {
    return modN(bits2int(bytes));
  };
  const ORDER_MASK = bitMask(CURVE.nBitLength);
  function int2octets(num) {
    if (typeof num !== "bigint")
      throw new Error("bigint expected");
    if (!(_0n5 <= num && num < ORDER_MASK))
      throw new Error(`bigint expected < 2^${CURVE.nBitLength}`);
    return numberToBytesBE(num, CURVE.nByteLength);
  }
  function prepSig(msgHash, privateKey, opts = defaultSigOpts) {
    if (["recovered", "canonical"].some((k) => (k in opts)))
      throw new Error("sign() legacy options not supported");
    const { hash, randomBytes } = CURVE;
    let { lowS, prehash, extraEntropy: ent } = opts;
    if (lowS == null)
      lowS = true;
    msgHash = ensureBytes("msgHash", msgHash);
    if (prehash)
      msgHash = ensureBytes("prehashed msgHash", hash(msgHash));
    const h1int = bits2int_modN(msgHash);
    const d = normPrivateKeyToScalar(privateKey);
    const seedArgs = [int2octets(d), int2octets(h1int)];
    if (ent != null) {
      const e = ent === true ? randomBytes(Fp.BYTES) : ent;
      seedArgs.push(ensureBytes("extraEntropy", e));
    }
    const seed = concatBytes2(...seedArgs);
    const m = h1int;
    function k2sig(kBytes) {
      const k = bits2int(kBytes);
      if (!isWithinCurveOrder(k))
        return;
      const ik = invN(k);
      const q = Point.BASE.multiply(k).toAffine();
      const r = modN(q.x);
      if (r === _0n5)
        return;
      const s = modN(ik * modN(m + r * d));
      if (s === _0n5)
        return;
      let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n5);
      let normS = s;
      if (lowS && isBiggerThanHalfOrder(s)) {
        normS = normalizeS(s);
        recovery ^= 1;
      }
      return new Signature(r, normS, recovery);
    }
    return { seed, k2sig };
  }
  const defaultSigOpts = { lowS: CURVE.lowS, prehash: false };
  const defaultVerOpts = { lowS: CURVE.lowS, prehash: false };
  function sign(msgHash, privKey, opts = defaultSigOpts) {
    const { seed, k2sig } = prepSig(msgHash, privKey, opts);
    const C = CURVE;
    const drbg = createHmacDrbg(C.hash.outputLen, C.nByteLength, C.hmac);
    return drbg(seed, k2sig);
  }
  Point.BASE._setWindowSize(8);
  function verify(signature, msgHash, publicKey, opts = defaultVerOpts) {
    const sg = signature;
    msgHash = ensureBytes("msgHash", msgHash);
    publicKey = ensureBytes("publicKey", publicKey);
    if ("strict" in opts)
      throw new Error("options.strict was renamed to lowS");
    const { lowS, prehash } = opts;
    let _sig = undefined;
    let P;
    try {
      if (typeof sg === "string" || sg instanceof Uint8Array) {
        try {
          _sig = Signature.fromDER(sg);
        } catch (derError) {
          if (!(derError instanceof DER.Err))
            throw derError;
          _sig = Signature.fromCompact(sg);
        }
      } else if (typeof sg === "object" && typeof sg.r === "bigint" && typeof sg.s === "bigint") {
        const { r, s } = sg;
        _sig = new Signature(r, s);
      } else {
        throw new Error("PARSE");
      }
      P = Point.fromHex(publicKey);
    } catch (error) {
      if (error.message === "PARSE")
        throw new Error(`signature must be Signature instance, Uint8Array or hex string`);
      return false;
    }
    if (lowS && _sig.hasHighS())
      return false;
    if (prehash)
      msgHash = CURVE.hash(msgHash);
    const { r, s } = _sig;
    const h = bits2int_modN(msgHash);
    const is = invN(s);
    const u1 = modN(h * is);
    const u2 = modN(r * is);
    const R = Point.BASE.multiplyAndAddUnsafe(P, u1, u2)?.toAffine();
    if (!R)
      return false;
    const v = modN(R.x);
    return v === r;
  }
  return {
    CURVE,
    getPublicKey,
    getSharedSecret,
    sign,
    verify,
    ProjectivePoint: Point,
    Signature,
    utils
  };
}

// work/tripvault-room-server/node_modules/@noble/curves/esm/_shortw_utils.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function getHash(hash) {
  return {
    hash,
    hmac: (key, ...msgs) => hmac(hash, key, concatBytes(...msgs)),
    randomBytes
  };
}
function createCurve(curveDef, defHash) {
  const create = (hash) => weierstrass({ ...curveDef, ...getHash(hash) });
  return Object.freeze({ ...create(defHash), create });
}

// work/tripvault-room-server/node_modules/@noble/curves/esm/secp256k1.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var secp256k1P = BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f");
var secp256k1N = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");
var _1n6 = BigInt(1);
var _2n5 = BigInt(2);
var divNearest = (a, b) => (a + b / _2n5) / b;
function sqrtMod(y) {
  const P = secp256k1P;
  const _3n = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
  const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
  const b2 = y * y * y % P;
  const b3 = b2 * b2 * y % P;
  const b6 = pow2(b3, _3n, P) * b3 % P;
  const b9 = pow2(b6, _3n, P) * b3 % P;
  const b11 = pow2(b9, _2n5, P) * b2 % P;
  const b22 = pow2(b11, _11n, P) * b11 % P;
  const b44 = pow2(b22, _22n, P) * b22 % P;
  const b88 = pow2(b44, _44n, P) * b44 % P;
  const b176 = pow2(b88, _88n, P) * b88 % P;
  const b220 = pow2(b176, _44n, P) * b44 % P;
  const b223 = pow2(b220, _3n, P) * b3 % P;
  const t1 = pow2(b223, _23n, P) * b22 % P;
  const t2 = pow2(t1, _6n, P) * b2 % P;
  const root = pow2(t2, _2n5, P);
  if (!Fp.eql(Fp.sqr(root), y))
    throw new Error("Cannot find square root");
  return root;
}
var Fp = Field(secp256k1P, undefined, undefined, { sqrt: sqrtMod });
var secp256k1 = createCurve({
  a: BigInt(0),
  b: BigInt(7),
  Fp,
  n: secp256k1N,
  Gx: BigInt("55066263022277343669578718895168534326250603453777594175500187360389116729240"),
  Gy: BigInt("32670510020758816978083085130507043184471273380659243275938904335757337482424"),
  h: BigInt(1),
  lowS: true,
  endo: {
    beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
    splitScalar: (k) => {
      const n = secp256k1N;
      const a1 = BigInt("0x3086d221a7d46bcde86c90e49284eb15");
      const b1 = -_1n6 * BigInt("0xe4437ed6010e88286f547fa90abfe4c3");
      const a2 = BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8");
      const b2 = a1;
      const POW_2_128 = BigInt("0x100000000000000000000000000000000");
      const c1 = divNearest(b2 * k, n);
      const c2 = divNearest(-b1 * k, n);
      let k1 = mod(k - c1 * a1 - c2 * a2, n);
      let k2 = mod(-c1 * b1 - c2 * b2, n);
      const k1neg = k1 > POW_2_128;
      const k2neg = k2 > POW_2_128;
      if (k1neg)
        k1 = n - k1;
      if (k2neg)
        k2 = n - k2;
      if (k1 > POW_2_128 || k2 > POW_2_128) {
        throw new Error("splitScalar: Endomorphism failed, k=" + k);
      }
      return { k1neg, k1, k2neg, k2 };
    }
  }
}, sha256);
var _0n6 = BigInt(0);
var Point = secp256k1.ProjectivePoint;

// work/tripvault-room-server/node_modules/ethers/lib.esm/constants/hashes.js
var ZeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
// work/tripvault-room-server/node_modules/ethers/lib.esm/constants/strings.js
var MessagePrefix = `\x19Ethereum Signed Message:
`;
// work/tripvault-room-server/node_modules/ethers/lib.esm/crypto/signature.js
var BN_02 = BigInt(0);
var BN_12 = BigInt(1);
var BN_2 = BigInt(2);
var BN_27 = BigInt(27);
var BN_28 = BigInt(28);
var BN_35 = BigInt(35);
var BN_N = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141");
var BN_N_2 = BN_N / BN_2;
var inspect = Symbol.for("nodejs.util.inspect.custom");
var _guard2 = {};
function toUint256(value) {
  return zeroPadValue(toBeArray(value), 32);
}

class Signature {
  #r;
  #s;
  #v;
  #networkV;
  get r() {
    return this.#r;
  }
  set r(value) {
    assertArgument(dataLength(value) === 32, "invalid r", "value", value);
    this.#r = hexlify(value);
  }
  get s() {
    assertArgument(parseInt(this.#s.substring(0, 3)) < 8, "non-canonical s; use ._s", "s", this.#s);
    return this.#s;
  }
  set s(_value) {
    assertArgument(dataLength(_value) === 32, "invalid s", "value", _value);
    this.#s = hexlify(_value);
  }
  get _s() {
    return this.#s;
  }
  isValid() {
    const s = BigInt(this.#s);
    return s <= BN_N_2;
  }
  get v() {
    return this.#v;
  }
  set v(value) {
    const v = getNumber(value, "value");
    assertArgument(v === 27 || v === 28, "invalid v", "v", value);
    this.#v = v;
  }
  get networkV() {
    return this.#networkV;
  }
  get legacyChainId() {
    const v = this.networkV;
    if (v == null) {
      return null;
    }
    return Signature.getChainId(v);
  }
  get yParity() {
    return this.v === 27 ? 0 : 1;
  }
  get yParityAndS() {
    const yParityAndS = getBytes(this.s);
    if (this.yParity) {
      yParityAndS[0] |= 128;
    }
    return hexlify(yParityAndS);
  }
  get compactSerialized() {
    return concat([this.r, this.yParityAndS]);
  }
  get serialized() {
    return concat([this.r, this.s, this.yParity ? "0x1c" : "0x1b"]);
  }
  constructor(guard, r, s, v) {
    assertPrivate(guard, _guard2, "Signature");
    this.#r = r;
    this.#s = s;
    this.#v = v;
    this.#networkV = null;
  }
  getCanonical() {
    if (this.isValid()) {
      return this;
    }
    const s = BN_N - BigInt(this._s);
    const v = 55 - this.v;
    const result = new Signature(_guard2, this.r, toUint256(s), v);
    if (this.networkV) {
      result.#networkV = this.networkV;
    }
    return result;
  }
  clone() {
    const clone = new Signature(_guard2, this.r, this._s, this.v);
    if (this.networkV) {
      clone.#networkV = this.networkV;
    }
    return clone;
  }
  toJSON() {
    const networkV = this.networkV;
    return {
      _type: "signature",
      networkV: networkV != null ? networkV.toString() : null,
      r: this.r,
      s: this._s,
      v: this.v
    };
  }
  [inspect]() {
    return this.toString();
  }
  toString() {
    if (this.isValid()) {
      return `Signature { r: ${this.r}, s: ${this._s}, v: ${this.v} }`;
    }
    return `Signature { r: ${this.r}, s: ${this._s}, v: ${this.v}, valid: false }`;
  }
  static getChainId(v) {
    const bv = getBigInt(v, "v");
    if (bv == BN_27 || bv == BN_28) {
      return BN_02;
    }
    assertArgument(bv >= BN_35, "invalid EIP-155 v", "v", v);
    return (bv - BN_35) / BN_2;
  }
  static getChainIdV(chainId, v) {
    return getBigInt(chainId) * BN_2 + BigInt(35 + v - 27);
  }
  static getNormalizedV(v) {
    const bv = getBigInt(v);
    if (bv === BN_02 || bv === BN_27) {
      return 27;
    }
    if (bv === BN_12 || bv === BN_28) {
      return 28;
    }
    assertArgument(bv >= BN_35, "invalid v", "v", v);
    return bv & BN_12 ? 27 : 28;
  }
  static from(sig) {
    function assertError(check, message) {
      assertArgument(check, message, "signature", sig);
    }
    if (sig == null) {
      return new Signature(_guard2, ZeroHash, ZeroHash, 27);
    }
    if (typeof sig === "string") {
      const bytes = getBytes(sig, "signature");
      if (bytes.length === 64) {
        const r = hexlify(bytes.slice(0, 32));
        const s = bytes.slice(32, 64);
        const v = s[0] & 128 ? 28 : 27;
        s[0] &= 127;
        return new Signature(_guard2, r, hexlify(s), v);
      }
      if (bytes.length === 65) {
        const r = hexlify(bytes.slice(0, 32));
        const s = hexlify(bytes.slice(32, 64));
        const v = Signature.getNormalizedV(bytes[64]);
        return new Signature(_guard2, r, s, v);
      }
      assertError(false, "invalid raw signature length");
    }
    if (sig instanceof Signature) {
      return sig.clone();
    }
    const _r = sig.r;
    assertError(_r != null, "missing r");
    const r = toUint256(_r);
    const s = function(s, yParityAndS) {
      if (s != null) {
        return toUint256(s);
      }
      if (yParityAndS != null) {
        assertError(isHexString(yParityAndS, 32), "invalid yParityAndS");
        const bytes = getBytes(yParityAndS);
        bytes[0] &= 127;
        return hexlify(bytes);
      }
      assertError(false, "missing s");
    }(sig.s, sig.yParityAndS);
    const { networkV, v } = function(_v, yParityAndS, yParity) {
      if (_v != null) {
        const v = getBigInt(_v);
        return {
          networkV: v >= BN_35 ? v : undefined,
          v: Signature.getNormalizedV(v)
        };
      }
      if (yParityAndS != null) {
        assertError(isHexString(yParityAndS, 32), "invalid yParityAndS");
        return { v: getBytes(yParityAndS)[0] & 128 ? 28 : 27 };
      }
      if (yParity != null) {
        switch (getNumber(yParity, "sig.yParity")) {
          case 0:
            return { v: 27 };
          case 1:
            return { v: 28 };
        }
        assertError(false, "invalid yParity");
      }
      assertError(false, "missing v");
    }(sig.v, sig.yParityAndS, sig.yParity);
    const result = new Signature(_guard2, r, s, v);
    if (networkV) {
      result.#networkV = networkV;
    }
    assertError(sig.yParity == null || getNumber(sig.yParity, "sig.yParity") === result.yParity, "yParity mismatch");
    assertError(sig.yParityAndS == null || sig.yParityAndS === result.yParityAndS, "yParityAndS mismatch");
    return result;
  }
}

// work/tripvault-room-server/node_modules/ethers/lib.esm/crypto/signing-key.js
class SigningKey {
  #privateKey;
  constructor(privateKey) {
    assertArgument(dataLength(privateKey) === 32, "invalid private key", "privateKey", "[REDACTED]");
    this.#privateKey = hexlify(privateKey);
  }
  get privateKey() {
    return this.#privateKey;
  }
  get publicKey() {
    return SigningKey.computePublicKey(this.#privateKey);
  }
  get compressedPublicKey() {
    return SigningKey.computePublicKey(this.#privateKey, true);
  }
  sign(digest) {
    assertArgument(dataLength(digest) === 32, "invalid digest length", "digest", digest);
    const sig = secp256k1.sign(getBytesCopy(digest), getBytesCopy(this.#privateKey), {
      lowS: true
    });
    return Signature.from({
      r: toBeHex(sig.r, 32),
      s: toBeHex(sig.s, 32),
      v: sig.recovery ? 28 : 27
    });
  }
  computeSharedSecret(other) {
    const pubKey = SigningKey.computePublicKey(other);
    return hexlify(secp256k1.getSharedSecret(getBytesCopy(this.#privateKey), getBytes(pubKey), false));
  }
  static computePublicKey(key, compressed) {
    let bytes = getBytes(key, "key");
    if (bytes.length === 32) {
      const pubKey = secp256k1.getPublicKey(bytes, !!compressed);
      return hexlify(pubKey);
    }
    if (bytes.length === 64) {
      const pub = new Uint8Array(65);
      pub[0] = 4;
      pub.set(bytes, 1);
      bytes = pub;
    }
    const point = secp256k1.ProjectivePoint.fromHex(bytes);
    return hexlify(point.toRawBytes(compressed));
  }
  static recoverPublicKey(digest, signature) {
    assertArgument(dataLength(digest) === 32, "invalid digest length", "digest", digest);
    const sig = Signature.from(signature);
    let secpSig = secp256k1.Signature.fromCompact(getBytesCopy(concat([sig.r, sig.s])));
    secpSig = secpSig.addRecoveryBit(sig.yParity);
    const pubKey = secpSig.recoverPublicKey(getBytesCopy(digest));
    assertArgument(pubKey != null, "invalid signature for digest", "signature", signature);
    return "0x" + pubKey.toHex(false);
  }
  static addPoints(p0, p1, compressed) {
    const pub0 = secp256k1.ProjectivePoint.fromHex(SigningKey.computePublicKey(p0).substring(2));
    const pub1 = secp256k1.ProjectivePoint.fromHex(SigningKey.computePublicKey(p1).substring(2));
    return "0x" + pub0.add(pub1).toHex(!!compressed);
  }
}
// work/tripvault-room-server/node_modules/ethers/lib.esm/address/address.js
var BN_03 = BigInt(0);
var BN_36 = BigInt(36);
function getChecksumAddress(address) {
  address = address.toLowerCase();
  const chars = address.substring(2).split("");
  const expanded = new Uint8Array(40);
  for (let i = 0;i < 40; i++) {
    expanded[i] = chars[i].charCodeAt(0);
  }
  const hashed = getBytes(keccak256(expanded));
  for (let i = 0;i < 40; i += 2) {
    if (hashed[i >> 1] >> 4 >= 8) {
      chars[i] = chars[i].toUpperCase();
    }
    if ((hashed[i >> 1] & 15) >= 8) {
      chars[i + 1] = chars[i + 1].toUpperCase();
    }
  }
  return "0x" + chars.join("");
}
var ibanLookup = {};
for (let i = 0;i < 10; i++) {
  ibanLookup[String(i)] = String(i);
}
for (let i = 0;i < 26; i++) {
  ibanLookup[String.fromCharCode(65 + i)] = String(10 + i);
}
var safeDigits = 15;
function ibanChecksum(address) {
  address = address.toUpperCase();
  address = address.substring(4) + address.substring(0, 2) + "00";
  let expanded = address.split("").map((c) => {
    return ibanLookup[c];
  }).join("");
  while (expanded.length >= safeDigits) {
    let block = expanded.substring(0, safeDigits);
    expanded = parseInt(block, 10) % 97 + expanded.substring(block.length);
  }
  let checksum = String(98 - parseInt(expanded, 10) % 97);
  while (checksum.length < 2) {
    checksum = "0" + checksum;
  }
  return checksum;
}
var Base36 = function() {
  const result = {};
  for (let i = 0;i < 36; i++) {
    const key = "0123456789abcdefghijklmnopqrstuvwxyz"[i];
    result[key] = BigInt(i);
  }
  return result;
}();
function fromBase36(value) {
  value = value.toLowerCase();
  let result = BN_03;
  for (let i = 0;i < value.length; i++) {
    result = result * BN_36 + Base36[value[i]];
  }
  return result;
}
function getAddress(address) {
  assertArgument(typeof address === "string", "invalid address", "address", address);
  if (address.match(/^(0x)?[0-9a-fA-F]{40}$/)) {
    if (!address.startsWith("0x")) {
      address = "0x" + address;
    }
    const result = getChecksumAddress(address);
    assertArgument(!address.match(/([A-F].*[a-f])|([a-f].*[A-F])/) || result === address, "bad address checksum", "address", address);
    return result;
  }
  if (address.match(/^XE[0-9]{2}[0-9A-Za-z]{30,31}$/)) {
    assertArgument(address.substring(2, 4) === ibanChecksum(address), "bad icap checksum", "address", address);
    let result = fromBase36(address.substring(4)).toString(16);
    while (result.length < 40) {
      result = "0" + result;
    }
    return getChecksumAddress("0x" + result);
  }
  assertArgument(false, "invalid address", "address", address);
}
// work/tripvault-room-server/node_modules/ethers/lib.esm/abi/typed.js
var _gaurd = {};
function n(value, width) {
  let signed = false;
  if (width < 0) {
    signed = true;
    width *= -1;
  }
  return new Typed(_gaurd, `${signed ? "" : "u"}int${width}`, value, { signed, width });
}
function b(value, size) {
  return new Typed(_gaurd, `bytes${size ? size : ""}`, value, { size });
}
var _typedSymbol = Symbol.for("_ethers_typed");

class Typed {
  type;
  value;
  #options;
  _typedSymbol;
  constructor(gaurd, type, value, options) {
    if (options == null) {
      options = null;
    }
    assertPrivate(_gaurd, gaurd, "Typed");
    defineProperties(this, { _typedSymbol, type, value });
    this.#options = options;
    this.format();
  }
  format() {
    if (this.type === "array") {
      throw new Error("");
    } else if (this.type === "dynamicArray") {
      throw new Error("");
    } else if (this.type === "tuple") {
      return `tuple(${this.value.map((v) => v.format()).join(",")})`;
    }
    return this.type;
  }
  defaultValue() {
    return 0;
  }
  minValue() {
    return 0;
  }
  maxValue() {
    return 0;
  }
  isBigInt() {
    return !!this.type.match(/^u?int[0-9]+$/);
  }
  isData() {
    return this.type.startsWith("bytes");
  }
  isString() {
    return this.type === "string";
  }
  get tupleName() {
    if (this.type !== "tuple") {
      throw TypeError("not a tuple");
    }
    return this.#options;
  }
  get arrayLength() {
    if (this.type !== "array") {
      throw TypeError("not an array");
    }
    if (this.#options === true) {
      return -1;
    }
    if (this.#options === false) {
      return this.value.length;
    }
    return null;
  }
  static from(type, value) {
    return new Typed(_gaurd, type, value);
  }
  static uint8(v) {
    return n(v, 8);
  }
  static uint16(v) {
    return n(v, 16);
  }
  static uint24(v) {
    return n(v, 24);
  }
  static uint32(v) {
    return n(v, 32);
  }
  static uint40(v) {
    return n(v, 40);
  }
  static uint48(v) {
    return n(v, 48);
  }
  static uint56(v) {
    return n(v, 56);
  }
  static uint64(v) {
    return n(v, 64);
  }
  static uint72(v) {
    return n(v, 72);
  }
  static uint80(v) {
    return n(v, 80);
  }
  static uint88(v) {
    return n(v, 88);
  }
  static uint96(v) {
    return n(v, 96);
  }
  static uint104(v) {
    return n(v, 104);
  }
  static uint112(v) {
    return n(v, 112);
  }
  static uint120(v) {
    return n(v, 120);
  }
  static uint128(v) {
    return n(v, 128);
  }
  static uint136(v) {
    return n(v, 136);
  }
  static uint144(v) {
    return n(v, 144);
  }
  static uint152(v) {
    return n(v, 152);
  }
  static uint160(v) {
    return n(v, 160);
  }
  static uint168(v) {
    return n(v, 168);
  }
  static uint176(v) {
    return n(v, 176);
  }
  static uint184(v) {
    return n(v, 184);
  }
  static uint192(v) {
    return n(v, 192);
  }
  static uint200(v) {
    return n(v, 200);
  }
  static uint208(v) {
    return n(v, 208);
  }
  static uint216(v) {
    return n(v, 216);
  }
  static uint224(v) {
    return n(v, 224);
  }
  static uint232(v) {
    return n(v, 232);
  }
  static uint240(v) {
    return n(v, 240);
  }
  static uint248(v) {
    return n(v, 248);
  }
  static uint256(v) {
    return n(v, 256);
  }
  static uint(v) {
    return n(v, 256);
  }
  static int8(v) {
    return n(v, -8);
  }
  static int16(v) {
    return n(v, -16);
  }
  static int24(v) {
    return n(v, -24);
  }
  static int32(v) {
    return n(v, -32);
  }
  static int40(v) {
    return n(v, -40);
  }
  static int48(v) {
    return n(v, -48);
  }
  static int56(v) {
    return n(v, -56);
  }
  static int64(v) {
    return n(v, -64);
  }
  static int72(v) {
    return n(v, -72);
  }
  static int80(v) {
    return n(v, -80);
  }
  static int88(v) {
    return n(v, -88);
  }
  static int96(v) {
    return n(v, -96);
  }
  static int104(v) {
    return n(v, -104);
  }
  static int112(v) {
    return n(v, -112);
  }
  static int120(v) {
    return n(v, -120);
  }
  static int128(v) {
    return n(v, -128);
  }
  static int136(v) {
    return n(v, -136);
  }
  static int144(v) {
    return n(v, -144);
  }
  static int152(v) {
    return n(v, -152);
  }
  static int160(v) {
    return n(v, -160);
  }
  static int168(v) {
    return n(v, -168);
  }
  static int176(v) {
    return n(v, -176);
  }
  static int184(v) {
    return n(v, -184);
  }
  static int192(v) {
    return n(v, -192);
  }
  static int200(v) {
    return n(v, -200);
  }
  static int208(v) {
    return n(v, -208);
  }
  static int216(v) {
    return n(v, -216);
  }
  static int224(v) {
    return n(v, -224);
  }
  static int232(v) {
    return n(v, -232);
  }
  static int240(v) {
    return n(v, -240);
  }
  static int248(v) {
    return n(v, -248);
  }
  static int256(v) {
    return n(v, -256);
  }
  static int(v) {
    return n(v, -256);
  }
  static bytes1(v) {
    return b(v, 1);
  }
  static bytes2(v) {
    return b(v, 2);
  }
  static bytes3(v) {
    return b(v, 3);
  }
  static bytes4(v) {
    return b(v, 4);
  }
  static bytes5(v) {
    return b(v, 5);
  }
  static bytes6(v) {
    return b(v, 6);
  }
  static bytes7(v) {
    return b(v, 7);
  }
  static bytes8(v) {
    return b(v, 8);
  }
  static bytes9(v) {
    return b(v, 9);
  }
  static bytes10(v) {
    return b(v, 10);
  }
  static bytes11(v) {
    return b(v, 11);
  }
  static bytes12(v) {
    return b(v, 12);
  }
  static bytes13(v) {
    return b(v, 13);
  }
  static bytes14(v) {
    return b(v, 14);
  }
  static bytes15(v) {
    return b(v, 15);
  }
  static bytes16(v) {
    return b(v, 16);
  }
  static bytes17(v) {
    return b(v, 17);
  }
  static bytes18(v) {
    return b(v, 18);
  }
  static bytes19(v) {
    return b(v, 19);
  }
  static bytes20(v) {
    return b(v, 20);
  }
  static bytes21(v) {
    return b(v, 21);
  }
  static bytes22(v) {
    return b(v, 22);
  }
  static bytes23(v) {
    return b(v, 23);
  }
  static bytes24(v) {
    return b(v, 24);
  }
  static bytes25(v) {
    return b(v, 25);
  }
  static bytes26(v) {
    return b(v, 26);
  }
  static bytes27(v) {
    return b(v, 27);
  }
  static bytes28(v) {
    return b(v, 28);
  }
  static bytes29(v) {
    return b(v, 29);
  }
  static bytes30(v) {
    return b(v, 30);
  }
  static bytes31(v) {
    return b(v, 31);
  }
  static bytes32(v) {
    return b(v, 32);
  }
  static address(v) {
    return new Typed(_gaurd, "address", v);
  }
  static bool(v) {
    return new Typed(_gaurd, "bool", !!v);
  }
  static bytes(v) {
    return new Typed(_gaurd, "bytes", v);
  }
  static string(v) {
    return new Typed(_gaurd, "string", v);
  }
  static array(v, dynamic) {
    throw new Error("not implemented yet");
    return new Typed(_gaurd, "array", v, dynamic);
  }
  static tuple(v, name) {
    throw new Error("not implemented yet");
    return new Typed(_gaurd, "tuple", v, name);
  }
  static overrides(v) {
    return new Typed(_gaurd, "overrides", Object.assign({}, v));
  }
  static isTyped(value) {
    return value && typeof value === "object" && "_typedSymbol" in value && value._typedSymbol === _typedSymbol;
  }
  static dereference(value, type) {
    if (Typed.isTyped(value)) {
      if (value.type !== type) {
        throw new Error(`invalid type: expecetd ${type}, got ${value.type}`);
      }
      return value.value;
    }
    return value;
  }
}

// work/tripvault-room-server/node_modules/ethers/lib.esm/abi/coders/address.js
class AddressCoder extends Coder {
  constructor(localName) {
    super("address", "address", localName, false);
  }
  defaultValue() {
    return "0x0000000000000000000000000000000000000000";
  }
  encode(writer, _value) {
    let value = Typed.dereference(_value, "string");
    try {
      value = getAddress(value);
    } catch (error) {
      return this._throwError(error.message, _value);
    }
    return writer.writeValue(value);
  }
  decode(reader) {
    return getAddress(toBeHex(reader.readValue(), 20));
  }
}

// work/tripvault-room-server/node_modules/ethers/lib.esm/abi/coders/anonymous.js
class AnonymousCoder extends Coder {
  coder;
  constructor(coder) {
    super(coder.name, coder.type, "_", coder.dynamic);
    this.coder = coder;
  }
  defaultValue() {
    return this.coder.defaultValue();
  }
  encode(writer, value) {
    return this.coder.encode(writer, value);
  }
  decode(reader) {
    return this.coder.decode(reader);
  }
}

// work/tripvault-room-server/node_modules/ethers/lib.esm/abi/coders/array.js
function pack(writer, coders, values) {
  let arrayValues = [];
  if (Array.isArray(values)) {
    arrayValues = values;
  } else if (values && typeof values === "object") {
    let unique = {};
    arrayValues = coders.map((coder) => {
      const name = coder.localName;
      assert(name, "cannot encode object for signature with missing names", "INVALID_ARGUMENT", { argument: "values", info: { coder }, value: values });
      assert(!unique[name], "cannot encode object for signature with duplicate names", "INVALID_ARGUMENT", { argument: "values", info: { coder }, value: values });
      unique[name] = true;
      return values[name];
    });
  } else {
    assertArgument(false, "invalid tuple value", "tuple", values);
  }
  assertArgument(coders.length === arrayValues.length, "types/value length mismatch", "tuple", values);
  let staticWriter = new Writer;
  let dynamicWriter = new Writer;
  let updateFuncs = [];
  coders.forEach((coder, index) => {
    let value = arrayValues[index];
    if (coder.dynamic) {
      let dynamicOffset = dynamicWriter.length;
      coder.encode(dynamicWriter, value);
      let updateFunc = staticWriter.writeUpdatableValue();
      updateFuncs.push((baseOffset) => {
        updateFunc(baseOffset + dynamicOffset);
      });
    } else {
      coder.encode(staticWriter, value);
    }
  });
  updateFuncs.forEach((func) => {
    func(staticWriter.length);
  });
  let length = writer.appendWriter(staticWriter);
  length += writer.appendWriter(dynamicWriter);
  return length;
}
function unpack(reader, coders) {
  let values = [];
  let keys = [];
  let baseReader = reader.subReader(0);
  coders.forEach((coder) => {
    let value = null;
    if (coder.dynamic) {
      let offset = reader.readIndex();
      let offsetReader = baseReader.subReader(offset);
      try {
        value = coder.decode(offsetReader);
      } catch (error) {
        if (isError(error, "BUFFER_OVERRUN")) {
          throw error;
        }
        value = error;
        value.baseType = coder.name;
        value.name = coder.localName;
        value.type = coder.type;
      }
    } else {
      try {
        value = coder.decode(reader);
      } catch (error) {
        if (isError(error, "BUFFER_OVERRUN")) {
          throw error;
        }
        value = error;
        value.baseType = coder.name;
        value.name = coder.localName;
        value.type = coder.type;
      }
    }
    if (value == undefined) {
      throw new Error("investigate");
    }
    values.push(value);
    keys.push(coder.localName || null);
  });
  return Result.fromItems(values, keys);
}

class ArrayCoder extends Coder {
  coder;
  length;
  constructor(coder, length, localName) {
    const type = coder.type + "[" + (length >= 0 ? length : "") + "]";
    const dynamic = length === -1 || coder.dynamic;
    super("array", type, localName, dynamic);
    defineProperties(this, { coder, length });
  }
  defaultValue() {
    const defaultChild = this.coder.defaultValue();
    const result = [];
    for (let i = 0;i < this.length; i++) {
      result.push(defaultChild);
    }
    return result;
  }
  encode(writer, _value) {
    const value = Typed.dereference(_value, "array");
    if (!Array.isArray(value)) {
      this._throwError("expected array value", value);
    }
    let count = this.length;
    if (count === -1) {
      count = value.length;
      writer.writeValue(value.length);
    }
    assertArgumentCount(value.length, count, "coder array" + (this.localName ? " " + this.localName : ""));
    let coders = [];
    for (let i = 0;i < value.length; i++) {
      coders.push(this.coder);
    }
    return pack(writer, coders, value);
  }
  decode(reader) {
    let count = this.length;
    if (count === -1) {
      count = reader.readIndex();
      assert(count * WordSize <= reader.dataLength, "insufficient data length", "BUFFER_OVERRUN", { buffer: reader.bytes, offset: count * WordSize, length: reader.dataLength });
    }
    let coders = [];
    for (let i = 0;i < count; i++) {
      coders.push(new AnonymousCoder(this.coder));
    }
    return unpack(reader, coders);
  }
}

// work/tripvault-room-server/node_modules/ethers/lib.esm/abi/coders/boolean.js
class BooleanCoder extends Coder {
  constructor(localName) {
    super("bool", "bool", localName, false);
  }
  defaultValue() {
    return false;
  }
  encode(writer, _value) {
    const value = Typed.dereference(_value, "bool");
    return writer.writeValue(value ? 1 : 0);
  }
  decode(reader) {
    return !!reader.readValue();
  }
}

// work/tripvault-room-server/node_modules/ethers/lib.esm/abi/coders/bytes.js
class DynamicBytesCoder extends Coder {
  constructor(type, localName) {
    super(type, type, localName, true);
  }
  defaultValue() {
    return "0x";
  }
  encode(writer, value) {
    value = getBytesCopy(value);
    let length = writer.writeValue(value.length);
    length += writer.writeBytes(value);
    return length;
  }
  decode(reader) {
    return reader.readBytes(reader.readIndex(), true);
  }
}

class BytesCoder extends DynamicBytesCoder {
  constructor(localName) {
    super("bytes", localName);
  }
  decode(reader) {
    return hexlify(super.decode(reader));
  }
}

// work/tripvault-room-server/node_modules/ethers/lib.esm/abi/coders/fixed-bytes.js
class FixedBytesCoder extends Coder {
  size;
  constructor(size, localName) {
    let name = "bytes" + String(size);
    super(name, name, localName, false);
    defineProperties(this, { size }, { size: "number" });
  }
  defaultValue() {
    return "0x0000000000000000000000000000000000000000000000000000000000000000".substring(0, 2 + this.size * 2);
  }
  encode(writer, _value) {
    let data = getBytesCopy(Typed.dereference(_value, this.type));
    if (data.length !== this.size) {
      this._throwError("incorrect data length", _value);
    }
    return writer.writeBytes(data);
  }
  decode(reader) {
    return hexlify(reader.readBytes(this.size));
  }
}

// work/tripvault-room-server/node_modules/ethers/lib.esm/abi/coders/null.js
var Empty = new Uint8Array([]);

class NullCoder extends Coder {
  constructor(localName) {
    super("null", "", localName, false);
  }
  defaultValue() {
    return null;
  }
  encode(writer, value) {
    if (value != null) {
      this._throwError("not null", value);
    }
    return writer.writeBytes(Empty);
  }
  decode(reader) {
    reader.readBytes(0);
    return null;
  }
}

// work/tripvault-room-server/node_modules/ethers/lib.esm/abi/coders/number.js
var BN_04 = BigInt(0);
var BN_13 = BigInt(1);
var BN_MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

class NumberCoder extends Coder {
  size;
  signed;
  constructor(size, signed, localName) {
    const name = (signed ? "int" : "uint") + size * 8;
    super(name, name, localName, false);
    defineProperties(this, { size, signed }, { size: "number", signed: "boolean" });
  }
  defaultValue() {
    return 0;
  }
  encode(writer, _value) {
    let value = getBigInt(Typed.dereference(_value, this.type));
    let maxUintValue = mask(BN_MAX_UINT256, WordSize * 8);
    if (this.signed) {
      let bounds = mask(maxUintValue, this.size * 8 - 1);
      if (value > bounds || value < -(bounds + BN_13)) {
        this._throwError("value out-of-bounds", _value);
      }
      value = toTwos(value, 8 * WordSize);
    } else if (value < BN_04 || value > mask(maxUintValue, this.size * 8)) {
      this._throwError("value out-of-bounds", _value);
    }
    return writer.writeValue(value);
  }
  decode(reader) {
    let value = mask(reader.readValue(), this.size * 8);
    if (this.signed) {
      value = fromTwos(value, this.size * 8);
    }
    return value;
  }
}

// work/tripvault-room-server/node_modules/ethers/lib.esm/abi/coders/string.js
class StringCoder extends DynamicBytesCoder {
  constructor(localName) {
    super("string", localName);
  }
  defaultValue() {
    return "";
  }
  encode(writer, _value) {
    return super.encode(writer, toUtf8Bytes(Typed.dereference(_value, "string")));
  }
  decode(reader) {
    return toUtf8String(super.decode(reader));
  }
}

// work/tripvault-room-server/node_modules/ethers/lib.esm/abi/coders/tuple.js
class TupleCoder extends Coder {
  coders;
  constructor(coders, localName) {
    let dynamic = false;
    const types = [];
    coders.forEach((coder) => {
      if (coder.dynamic) {
        dynamic = true;
      }
      types.push(coder.type);
    });
    const type = "tuple(" + types.join(",") + ")";
    super("tuple", type, localName, dynamic);
    defineProperties(this, { coders: Object.freeze(coders.slice()) });
  }
  defaultValue() {
    const values = [];
    this.coders.forEach((coder) => {
      values.push(coder.defaultValue());
    });
    const uniqueNames = this.coders.reduce((accum, coder) => {
      const name = coder.localName;
      if (name) {
        if (!accum[name]) {
          accum[name] = 0;
        }
        accum[name]++;
      }
      return accum;
    }, {});
    this.coders.forEach((coder, index) => {
      let name = coder.localName;
      if (!name || uniqueNames[name] !== 1) {
        return;
      }
      if (name === "length") {
        name = "_length";
      }
      if (values[name] != null) {
        return;
      }
      values[name] = values[index];
    });
    return Object.freeze(values);
  }
  encode(writer, _value) {
    const value = Typed.dereference(_value, "tuple");
    return pack(writer, this.coders, value);
  }
  decode(reader) {
    return unpack(reader, this.coders);
  }
}

// work/tripvault-room-server/node_modules/ethers/lib.esm/transaction/address.js
function computeAddress(key) {
  let pubkey;
  if (typeof key === "string") {
    pubkey = SigningKey.computePublicKey(key, false);
  } else {
    pubkey = key.publicKey;
  }
  return getAddress(keccak256("0x" + pubkey.substring(4)).substring(26));
}
function recoverAddress(digest, signature) {
  return computeAddress(SigningKey.recoverPublicKey(digest, signature));
}
// work/tripvault-room-server/node_modules/ethers/lib.esm/hash/id.js
function id(value) {
  return keccak256(toUtf8Bytes(value));
}
// work/tripvault-room-server/node_modules/ethers/lib.esm/hash/message.js
function hashMessage(message) {
  if (typeof message === "string") {
    message = toUtf8Bytes(message);
  }
  return keccak256(concat([
    toUtf8Bytes(MessagePrefix),
    toUtf8Bytes(String(message.length)),
    message
  ]));
}
function verifyMessage(message, sig) {
  const digest = hashMessage(message);
  return recoverAddress(digest, sig);
}
// work/tripvault-room-server/node_modules/ethers/lib.esm/abi/fragments.js
function setify(items) {
  const result = new Set;
  items.forEach((k) => result.add(k));
  return Object.freeze(result);
}
var _kwVisibDeploy = "external public payable override";
var KwVisibDeploy = setify(_kwVisibDeploy.split(" "));
var _kwVisib = "constant external internal payable private public pure view override";
var KwVisib = setify(_kwVisib.split(" "));
var _kwTypes = "constructor error event fallback function receive struct";
var KwTypes = setify(_kwTypes.split(" "));
var _kwModifiers = "calldata memory storage payable indexed";
var KwModifiers = setify(_kwModifiers.split(" "));
var _kwOther = "tuple returns";
var _keywords = [_kwTypes, _kwModifiers, _kwOther, _kwVisib].join(" ");
var Keywords = setify(_keywords.split(" "));
var SimpleTokens = {
  "(": "OPEN_PAREN",
  ")": "CLOSE_PAREN",
  "[": "OPEN_BRACKET",
  "]": "CLOSE_BRACKET",
  ",": "COMMA",
  "@": "AT"
};
var regexWhitespacePrefix = new RegExp("^(\\s*)");
var regexNumberPrefix = new RegExp("^([0-9]+)");
var regexIdPrefix = new RegExp("^([a-zA-Z$_][a-zA-Z0-9$_]*)");
var regexId = new RegExp("^([a-zA-Z$_][a-zA-Z0-9$_]*)$");
var regexType = new RegExp("^(address|bool|bytes([0-9]*)|string|u?int([0-9]*))$");

class TokenString {
  #offset;
  #tokens;
  get offset() {
    return this.#offset;
  }
  get length() {
    return this.#tokens.length - this.#offset;
  }
  constructor(tokens) {
    this.#offset = 0;
    this.#tokens = tokens.slice();
  }
  clone() {
    return new TokenString(this.#tokens);
  }
  reset() {
    this.#offset = 0;
  }
  #subTokenString(from = 0, to = 0) {
    return new TokenString(this.#tokens.slice(from, to).map((t) => {
      return Object.freeze(Object.assign({}, t, {
        match: t.match - from,
        linkBack: t.linkBack - from,
        linkNext: t.linkNext - from
      }));
    }));
  }
  popKeyword(allowed) {
    const top = this.peek();
    if (top.type !== "KEYWORD" || !allowed.has(top.text)) {
      throw new Error(`expected keyword ${top.text}`);
    }
    return this.pop().text;
  }
  popType(type) {
    if (this.peek().type !== type) {
      const top = this.peek();
      throw new Error(`expected ${type}; got ${top.type} ${JSON.stringify(top.text)}`);
    }
    return this.pop().text;
  }
  popParen() {
    const top = this.peek();
    if (top.type !== "OPEN_PAREN") {
      throw new Error("bad start");
    }
    const result = this.#subTokenString(this.#offset + 1, top.match + 1);
    this.#offset = top.match + 1;
    return result;
  }
  popParams() {
    const top = this.peek();
    if (top.type !== "OPEN_PAREN") {
      throw new Error("bad start");
    }
    const result = [];
    while (this.#offset < top.match - 1) {
      const link = this.peek().linkNext;
      result.push(this.#subTokenString(this.#offset + 1, link));
      this.#offset = link;
    }
    this.#offset = top.match + 1;
    return result;
  }
  peek() {
    if (this.#offset >= this.#tokens.length) {
      throw new Error("out-of-bounds");
    }
    return this.#tokens[this.#offset];
  }
  peekKeyword(allowed) {
    const top = this.peekType("KEYWORD");
    return top != null && allowed.has(top) ? top : null;
  }
  peekType(type) {
    if (this.length === 0) {
      return null;
    }
    const top = this.peek();
    return top.type === type ? top.text : null;
  }
  pop() {
    const result = this.peek();
    this.#offset++;
    return result;
  }
  toString() {
    const tokens = [];
    for (let i = this.#offset;i < this.#tokens.length; i++) {
      const token = this.#tokens[i];
      tokens.push(`${token.type}:${token.text}`);
    }
    return `<TokenString ${tokens.join(" ")}>`;
  }
}
function lex(text) {
  const tokens = [];
  const throwError = (message) => {
    const token = offset < text.length ? JSON.stringify(text[offset]) : "$EOI";
    throw new Error(`invalid token ${token} at ${offset}: ${message}`);
  };
  let brackets = [];
  let commas = [];
  let offset = 0;
  while (offset < text.length) {
    let cur = text.substring(offset);
    let match = cur.match(regexWhitespacePrefix);
    if (match) {
      offset += match[1].length;
      cur = text.substring(offset);
    }
    const token = { depth: brackets.length, linkBack: -1, linkNext: -1, match: -1, type: "", text: "", offset, value: -1 };
    tokens.push(token);
    let type = SimpleTokens[cur[0]] || "";
    if (type) {
      token.type = type;
      token.text = cur[0];
      offset++;
      if (type === "OPEN_PAREN") {
        brackets.push(tokens.length - 1);
        commas.push(tokens.length - 1);
      } else if (type == "CLOSE_PAREN") {
        if (brackets.length === 0) {
          throwError("no matching open bracket");
        }
        token.match = brackets.pop();
        tokens[token.match].match = tokens.length - 1;
        token.depth--;
        token.linkBack = commas.pop();
        tokens[token.linkBack].linkNext = tokens.length - 1;
      } else if (type === "COMMA") {
        token.linkBack = commas.pop();
        tokens[token.linkBack].linkNext = tokens.length - 1;
        commas.push(tokens.length - 1);
      } else if (type === "OPEN_BRACKET") {
        token.type = "BRACKET";
      } else if (type === "CLOSE_BRACKET") {
        let suffix = tokens.pop().text;
        if (tokens.length > 0 && tokens[tokens.length - 1].type === "NUMBER") {
          const value = tokens.pop().text;
          suffix = value + suffix;
          tokens[tokens.length - 1].value = getNumber(value);
        }
        if (tokens.length === 0 || tokens[tokens.length - 1].type !== "BRACKET") {
          throw new Error("missing opening bracket");
        }
        tokens[tokens.length - 1].text += suffix;
      }
      continue;
    }
    match = cur.match(regexIdPrefix);
    if (match) {
      token.text = match[1];
      offset += token.text.length;
      if (Keywords.has(token.text)) {
        token.type = "KEYWORD";
        continue;
      }
      if (token.text.match(regexType)) {
        token.type = "TYPE";
        continue;
      }
      token.type = "ID";
      continue;
    }
    match = cur.match(regexNumberPrefix);
    if (match) {
      token.text = match[1];
      token.type = "NUMBER";
      offset += token.text.length;
      continue;
    }
    throw new Error(`unexpected token ${JSON.stringify(cur[0])} at position ${offset}`);
  }
  return new TokenString(tokens.map((t) => Object.freeze(t)));
}
function allowSingle(set, allowed) {
  let included = [];
  for (const key in allowed.keys()) {
    if (set.has(key)) {
      included.push(key);
    }
  }
  if (included.length > 1) {
    throw new Error(`conflicting types: ${included.join(", ")}`);
  }
}
function consumeName(type, tokens) {
  if (tokens.peekKeyword(KwTypes)) {
    const keyword = tokens.pop().text;
    if (keyword !== type) {
      throw new Error(`expected ${type}, got ${keyword}`);
    }
  }
  return tokens.popType("ID");
}
function consumeKeywords(tokens, allowed) {
  const keywords = new Set;
  while (true) {
    const keyword = tokens.peekType("KEYWORD");
    if (keyword == null || allowed && !allowed.has(keyword)) {
      break;
    }
    tokens.pop();
    if (keywords.has(keyword)) {
      throw new Error(`duplicate keywords: ${JSON.stringify(keyword)}`);
    }
    keywords.add(keyword);
  }
  return Object.freeze(keywords);
}
function consumeMutability(tokens) {
  let modifiers = consumeKeywords(tokens, KwVisib);
  allowSingle(modifiers, setify("constant payable nonpayable".split(" ")));
  allowSingle(modifiers, setify("pure view payable nonpayable".split(" ")));
  if (modifiers.has("view")) {
    return "view";
  }
  if (modifiers.has("pure")) {
    return "pure";
  }
  if (modifiers.has("payable")) {
    return "payable";
  }
  if (modifiers.has("nonpayable")) {
    return "nonpayable";
  }
  if (modifiers.has("constant")) {
    return "view";
  }
  return "nonpayable";
}
function consumeParams(tokens, allowIndexed) {
  return tokens.popParams().map((t) => ParamType.from(t, allowIndexed));
}
function consumeGas(tokens) {
  if (tokens.peekType("AT")) {
    tokens.pop();
    if (tokens.peekType("NUMBER")) {
      return getBigInt(tokens.pop().text);
    }
    throw new Error("invalid gas");
  }
  return null;
}
function consumeEoi(tokens) {
  if (tokens.length) {
    throw new Error(`unexpected tokens at offset ${tokens.offset}: ${tokens.toString()}`);
  }
}
var regexArrayType = new RegExp(/^(.*)\[([0-9]*)\]$/);
function verifyBasicType(type) {
  const match = type.match(regexType);
  assertArgument(match, "invalid type", "type", type);
  if (type === "uint") {
    return "uint256";
  }
  if (type === "int") {
    return "int256";
  }
  if (match[2]) {
    const length = parseInt(match[2]);
    assertArgument(length !== 0 && length <= 32, "invalid bytes length", "type", type);
  } else if (match[3]) {
    const size = parseInt(match[3]);
    assertArgument(size !== 0 && size <= 256 && size % 8 === 0, "invalid numeric width", "type", type);
  }
  return type;
}
var _guard3 = {};
var internal = Symbol.for("_ethers_internal");
var ParamTypeInternal = "_ParamTypeInternal";
var ErrorFragmentInternal = "_ErrorInternal";
var EventFragmentInternal = "_EventInternal";
var ConstructorFragmentInternal = "_ConstructorInternal";
var FallbackFragmentInternal = "_FallbackInternal";
var FunctionFragmentInternal = "_FunctionInternal";
var StructFragmentInternal = "_StructInternal";

class ParamType {
  name;
  type;
  baseType;
  indexed;
  components;
  arrayLength;
  arrayChildren;
  constructor(guard, name, type, baseType, indexed, components, arrayLength, arrayChildren) {
    assertPrivate(guard, _guard3, "ParamType");
    Object.defineProperty(this, internal, { value: ParamTypeInternal });
    if (components) {
      components = Object.freeze(components.slice());
    }
    if (baseType === "array") {
      if (arrayLength == null || arrayChildren == null) {
        throw new Error("");
      }
    } else if (arrayLength != null || arrayChildren != null) {
      throw new Error("");
    }
    if (baseType === "tuple") {
      if (components == null) {
        throw new Error("");
      }
    } else if (components != null) {
      throw new Error("");
    }
    defineProperties(this, {
      name,
      type,
      baseType,
      indexed,
      components,
      arrayLength,
      arrayChildren
    });
  }
  format(format) {
    if (format == null) {
      format = "sighash";
    }
    if (format === "json") {
      const name = this.name || "";
      if (this.isArray()) {
        const result = JSON.parse(this.arrayChildren.format("json"));
        result.name = name;
        result.type += `[${this.arrayLength < 0 ? "" : String(this.arrayLength)}]`;
        return JSON.stringify(result);
      }
      const result = {
        type: this.baseType === "tuple" ? "tuple" : this.type,
        name
      };
      if (typeof this.indexed === "boolean") {
        result.indexed = this.indexed;
      }
      if (this.isTuple()) {
        result.components = this.components.map((c) => JSON.parse(c.format(format)));
      }
      return JSON.stringify(result);
    }
    let result = "";
    if (this.isArray()) {
      result += this.arrayChildren.format(format);
      result += `[${this.arrayLength < 0 ? "" : String(this.arrayLength)}]`;
    } else {
      if (this.isTuple()) {
        result += "(" + this.components.map((comp) => comp.format(format)).join(format === "full" ? ", " : ",") + ")";
      } else {
        result += this.type;
      }
    }
    if (format !== "sighash") {
      if (this.indexed === true) {
        result += " indexed";
      }
      if (format === "full" && this.name) {
        result += " " + this.name;
      }
    }
    return result;
  }
  isArray() {
    return this.baseType === "array";
  }
  isTuple() {
    return this.baseType === "tuple";
  }
  isIndexable() {
    return this.indexed != null;
  }
  walk(value, process2) {
    if (this.isArray()) {
      if (!Array.isArray(value)) {
        throw new Error("invalid array value");
      }
      if (this.arrayLength !== -1 && value.length !== this.arrayLength) {
        throw new Error("array is wrong length");
      }
      const _this = this;
      return value.map((v) => _this.arrayChildren.walk(v, process2));
    }
    if (this.isTuple()) {
      if (!Array.isArray(value)) {
        throw new Error("invalid tuple value");
      }
      if (value.length !== this.components.length) {
        throw new Error("array is wrong length");
      }
      const _this = this;
      return value.map((v, i) => _this.components[i].walk(v, process2));
    }
    return process2(this.type, value);
  }
  #walkAsync(promises, value, process2, setValue) {
    if (this.isArray()) {
      if (!Array.isArray(value)) {
        throw new Error("invalid array value");
      }
      if (this.arrayLength !== -1 && value.length !== this.arrayLength) {
        throw new Error("array is wrong length");
      }
      const childType = this.arrayChildren;
      const result = value.slice();
      result.forEach((value, index) => {
        childType.#walkAsync(promises, value, process2, (value) => {
          result[index] = value;
        });
      });
      setValue(result);
      return;
    }
    if (this.isTuple()) {
      const components = this.components;
      let result;
      if (Array.isArray(value)) {
        result = value.slice();
      } else {
        if (value == null || typeof value !== "object") {
          throw new Error("invalid tuple value");
        }
        result = components.map((param) => {
          if (!param.name) {
            throw new Error("cannot use object value with unnamed components");
          }
          if (!(param.name in value)) {
            throw new Error(`missing value for component ${param.name}`);
          }
          return value[param.name];
        });
      }
      if (result.length !== this.components.length) {
        throw new Error("array is wrong length");
      }
      result.forEach((value, index) => {
        components[index].#walkAsync(promises, value, process2, (value) => {
          result[index] = value;
        });
      });
      setValue(result);
      return;
    }
    const result = process2(this.type, value);
    if (result.then) {
      promises.push(async function() {
        setValue(await result);
      }());
    } else {
      setValue(result);
    }
  }
  async walkAsync(value, process2) {
    const promises = [];
    const result = [value];
    this.#walkAsync(promises, value, process2, (value) => {
      result[0] = value;
    });
    if (promises.length) {
      await Promise.all(promises);
    }
    return result[0];
  }
  static from(obj, allowIndexed) {
    if (ParamType.isParamType(obj)) {
      return obj;
    }
    if (typeof obj === "string") {
      try {
        return ParamType.from(lex(obj), allowIndexed);
      } catch (error) {
        assertArgument(false, "invalid param type", "obj", obj);
      }
    } else if (obj instanceof TokenString) {
      let type = "", baseType = "";
      let comps = null;
      if (consumeKeywords(obj, setify(["tuple"])).has("tuple") || obj.peekType("OPEN_PAREN")) {
        baseType = "tuple";
        comps = obj.popParams().map((t) => ParamType.from(t));
        type = `tuple(${comps.map((c) => c.format()).join(",")})`;
      } else {
        type = verifyBasicType(obj.popType("TYPE"));
        baseType = type;
      }
      let arrayChildren = null;
      let arrayLength = null;
      while (obj.length && obj.peekType("BRACKET")) {
        const bracket = obj.pop();
        arrayChildren = new ParamType(_guard3, "", type, baseType, null, comps, arrayLength, arrayChildren);
        arrayLength = bracket.value;
        type += bracket.text;
        baseType = "array";
        comps = null;
      }
      let indexed = null;
      const keywords = consumeKeywords(obj, KwModifiers);
      if (keywords.has("indexed")) {
        if (!allowIndexed) {
          throw new Error("");
        }
        indexed = true;
      }
      const name = obj.peekType("ID") ? obj.pop().text : "";
      if (obj.length) {
        throw new Error("leftover tokens");
      }
      return new ParamType(_guard3, name, type, baseType, indexed, comps, arrayLength, arrayChildren);
    }
    const name = obj.name;
    assertArgument(!name || typeof name === "string" && name.match(regexId), "invalid name", "obj.name", name);
    let indexed = obj.indexed;
    if (indexed != null) {
      assertArgument(allowIndexed, "parameter cannot be indexed", "obj.indexed", obj.indexed);
      indexed = !!indexed;
    }
    let type = obj.type;
    let arrayMatch = type.match(regexArrayType);
    if (arrayMatch) {
      const arrayLength = parseInt(arrayMatch[2] || "-1");
      const arrayChildren = ParamType.from({
        type: arrayMatch[1],
        components: obj.components
      });
      return new ParamType(_guard3, name || "", type, "array", indexed, null, arrayLength, arrayChildren);
    }
    if (type === "tuple" || type.startsWith("tuple(") || type.startsWith("(")) {
      const comps = obj.components != null ? obj.components.map((c) => ParamType.from(c)) : null;
      const tuple = new ParamType(_guard3, name || "", type, "tuple", indexed, comps, null, null);
      return tuple;
    }
    type = verifyBasicType(obj.type);
    return new ParamType(_guard3, name || "", type, type, indexed, null, null, null);
  }
  static isParamType(value) {
    return value && value[internal] === ParamTypeInternal;
  }
}

class Fragment {
  type;
  inputs;
  constructor(guard, type, inputs) {
    assertPrivate(guard, _guard3, "Fragment");
    inputs = Object.freeze(inputs.slice());
    defineProperties(this, { type, inputs });
  }
  static from(obj) {
    if (typeof obj === "string") {
      try {
        Fragment.from(JSON.parse(obj));
      } catch (e) {}
      return Fragment.from(lex(obj));
    }
    if (obj instanceof TokenString) {
      const type = obj.peekKeyword(KwTypes);
      switch (type) {
        case "constructor":
          return ConstructorFragment.from(obj);
        case "error":
          return ErrorFragment.from(obj);
        case "event":
          return EventFragment.from(obj);
        case "fallback":
        case "receive":
          return FallbackFragment.from(obj);
        case "function":
          return FunctionFragment.from(obj);
        case "struct":
          return StructFragment.from(obj);
      }
    } else if (typeof obj === "object") {
      switch (obj.type) {
        case "constructor":
          return ConstructorFragment.from(obj);
        case "error":
          return ErrorFragment.from(obj);
        case "event":
          return EventFragment.from(obj);
        case "fallback":
        case "receive":
          return FallbackFragment.from(obj);
        case "function":
          return FunctionFragment.from(obj);
        case "struct":
          return StructFragment.from(obj);
      }
      assert(false, `unsupported type: ${obj.type}`, "UNSUPPORTED_OPERATION", {
        operation: "Fragment.from"
      });
    }
    assertArgument(false, "unsupported frgament object", "obj", obj);
  }
  static isConstructor(value) {
    return ConstructorFragment.isFragment(value);
  }
  static isError(value) {
    return ErrorFragment.isFragment(value);
  }
  static isEvent(value) {
    return EventFragment.isFragment(value);
  }
  static isFunction(value) {
    return FunctionFragment.isFragment(value);
  }
  static isStruct(value) {
    return StructFragment.isFragment(value);
  }
}

class NamedFragment extends Fragment {
  name;
  constructor(guard, type, name, inputs) {
    super(guard, type, inputs);
    assertArgument(typeof name === "string" && name.match(regexId), "invalid identifier", "name", name);
    inputs = Object.freeze(inputs.slice());
    defineProperties(this, { name });
  }
}
function joinParams(format, params) {
  return "(" + params.map((p) => p.format(format)).join(format === "full" ? ", " : ",") + ")";
}

class ErrorFragment extends NamedFragment {
  constructor(guard, name, inputs) {
    super(guard, "error", name, inputs);
    Object.defineProperty(this, internal, { value: ErrorFragmentInternal });
  }
  get selector() {
    return id(this.format("sighash")).substring(0, 10);
  }
  format(format) {
    if (format == null) {
      format = "sighash";
    }
    if (format === "json") {
      return JSON.stringify({
        type: "error",
        name: this.name,
        inputs: this.inputs.map((input) => JSON.parse(input.format(format)))
      });
    }
    const result = [];
    if (format !== "sighash") {
      result.push("error");
    }
    result.push(this.name + joinParams(format, this.inputs));
    return result.join(" ");
  }
  static from(obj) {
    if (ErrorFragment.isFragment(obj)) {
      return obj;
    }
    if (typeof obj === "string") {
      return ErrorFragment.from(lex(obj));
    } else if (obj instanceof TokenString) {
      const name = consumeName("error", obj);
      const inputs = consumeParams(obj);
      consumeEoi(obj);
      return new ErrorFragment(_guard3, name, inputs);
    }
    return new ErrorFragment(_guard3, obj.name, obj.inputs ? obj.inputs.map(ParamType.from) : []);
  }
  static isFragment(value) {
    return value && value[internal] === ErrorFragmentInternal;
  }
}

class EventFragment extends NamedFragment {
  anonymous;
  constructor(guard, name, inputs, anonymous) {
    super(guard, "event", name, inputs);
    Object.defineProperty(this, internal, { value: EventFragmentInternal });
    defineProperties(this, { anonymous });
  }
  get topicHash() {
    return id(this.format("sighash"));
  }
  format(format) {
    if (format == null) {
      format = "sighash";
    }
    if (format === "json") {
      return JSON.stringify({
        type: "event",
        anonymous: this.anonymous,
        name: this.name,
        inputs: this.inputs.map((i) => JSON.parse(i.format(format)))
      });
    }
    const result = [];
    if (format !== "sighash") {
      result.push("event");
    }
    result.push(this.name + joinParams(format, this.inputs));
    if (format !== "sighash" && this.anonymous) {
      result.push("anonymous");
    }
    return result.join(" ");
  }
  static getTopicHash(name, params) {
    params = (params || []).map((p) => ParamType.from(p));
    const fragment = new EventFragment(_guard3, name, params, false);
    return fragment.topicHash;
  }
  static from(obj) {
    if (EventFragment.isFragment(obj)) {
      return obj;
    }
    if (typeof obj === "string") {
      try {
        return EventFragment.from(lex(obj));
      } catch (error) {
        assertArgument(false, "invalid event fragment", "obj", obj);
      }
    } else if (obj instanceof TokenString) {
      const name = consumeName("event", obj);
      const inputs = consumeParams(obj, true);
      const anonymous = !!consumeKeywords(obj, setify(["anonymous"])).has("anonymous");
      consumeEoi(obj);
      return new EventFragment(_guard3, name, inputs, anonymous);
    }
    return new EventFragment(_guard3, obj.name, obj.inputs ? obj.inputs.map((p) => ParamType.from(p, true)) : [], !!obj.anonymous);
  }
  static isFragment(value) {
    return value && value[internal] === EventFragmentInternal;
  }
}

class ConstructorFragment extends Fragment {
  payable;
  gas;
  constructor(guard, type, inputs, payable, gas) {
    super(guard, type, inputs);
    Object.defineProperty(this, internal, { value: ConstructorFragmentInternal });
    defineProperties(this, { payable, gas });
  }
  format(format) {
    assert(format != null && format !== "sighash", "cannot format a constructor for sighash", "UNSUPPORTED_OPERATION", { operation: "format(sighash)" });
    if (format === "json") {
      return JSON.stringify({
        type: "constructor",
        stateMutability: this.payable ? "payable" : "undefined",
        payable: this.payable,
        gas: this.gas != null ? this.gas : undefined,
        inputs: this.inputs.map((i) => JSON.parse(i.format(format)))
      });
    }
    const result = [`constructor${joinParams(format, this.inputs)}`];
    if (this.payable) {
      result.push("payable");
    }
    if (this.gas != null) {
      result.push(`@${this.gas.toString()}`);
    }
    return result.join(" ");
  }
  static from(obj) {
    if (ConstructorFragment.isFragment(obj)) {
      return obj;
    }
    if (typeof obj === "string") {
      try {
        return ConstructorFragment.from(lex(obj));
      } catch (error) {
        assertArgument(false, "invalid constuctor fragment", "obj", obj);
      }
    } else if (obj instanceof TokenString) {
      consumeKeywords(obj, setify(["constructor"]));
      const inputs = consumeParams(obj);
      const payable = !!consumeKeywords(obj, KwVisibDeploy).has("payable");
      const gas = consumeGas(obj);
      consumeEoi(obj);
      return new ConstructorFragment(_guard3, "constructor", inputs, payable, gas);
    }
    return new ConstructorFragment(_guard3, "constructor", obj.inputs ? obj.inputs.map(ParamType.from) : [], !!obj.payable, obj.gas != null ? obj.gas : null);
  }
  static isFragment(value) {
    return value && value[internal] === ConstructorFragmentInternal;
  }
}

class FallbackFragment extends Fragment {
  payable;
  constructor(guard, inputs, payable) {
    super(guard, "fallback", inputs);
    Object.defineProperty(this, internal, { value: FallbackFragmentInternal });
    defineProperties(this, { payable });
  }
  format(format) {
    const type = this.inputs.length === 0 ? "receive" : "fallback";
    if (format === "json") {
      const stateMutability = this.payable ? "payable" : "nonpayable";
      return JSON.stringify({ type, stateMutability });
    }
    return `${type}()${this.payable ? " payable" : ""}`;
  }
  static from(obj) {
    if (FallbackFragment.isFragment(obj)) {
      return obj;
    }
    if (typeof obj === "string") {
      try {
        return FallbackFragment.from(lex(obj));
      } catch (error) {
        assertArgument(false, "invalid fallback fragment", "obj", obj);
      }
    } else if (obj instanceof TokenString) {
      const errorObj = obj.toString();
      const topIsValid = obj.peekKeyword(setify(["fallback", "receive"]));
      assertArgument(topIsValid, "type must be fallback or receive", "obj", errorObj);
      const type = obj.popKeyword(setify(["fallback", "receive"]));
      if (type === "receive") {
        const inputs = consumeParams(obj);
        assertArgument(inputs.length === 0, `receive cannot have arguments`, "obj.inputs", inputs);
        consumeKeywords(obj, setify(["payable"]));
        consumeEoi(obj);
        return new FallbackFragment(_guard3, [], true);
      }
      let inputs = consumeParams(obj);
      if (inputs.length) {
        assertArgument(inputs.length === 1 && inputs[0].type === "bytes", "invalid fallback inputs", "obj.inputs", inputs.map((i) => i.format("minimal")).join(", "));
      } else {
        inputs = [ParamType.from("bytes")];
      }
      const mutability = consumeMutability(obj);
      assertArgument(mutability === "nonpayable" || mutability === "payable", "fallback cannot be constants", "obj.stateMutability", mutability);
      if (consumeKeywords(obj, setify(["returns"])).has("returns")) {
        const outputs = consumeParams(obj);
        assertArgument(outputs.length === 1 && outputs[0].type === "bytes", "invalid fallback outputs", "obj.outputs", outputs.map((i) => i.format("minimal")).join(", "));
      }
      consumeEoi(obj);
      return new FallbackFragment(_guard3, inputs, mutability === "payable");
    }
    if (obj.type === "receive") {
      return new FallbackFragment(_guard3, [], true);
    }
    if (obj.type === "fallback") {
      const inputs = [ParamType.from("bytes")];
      const payable = obj.stateMutability === "payable";
      return new FallbackFragment(_guard3, inputs, payable);
    }
    assertArgument(false, "invalid fallback description", "obj", obj);
  }
  static isFragment(value) {
    return value && value[internal] === FallbackFragmentInternal;
  }
}

class FunctionFragment extends NamedFragment {
  constant;
  outputs;
  stateMutability;
  payable;
  gas;
  constructor(guard, name, stateMutability, inputs, outputs, gas) {
    super(guard, "function", name, inputs);
    Object.defineProperty(this, internal, { value: FunctionFragmentInternal });
    outputs = Object.freeze(outputs.slice());
    const constant = stateMutability === "view" || stateMutability === "pure";
    const payable = stateMutability === "payable";
    defineProperties(this, { constant, gas, outputs, payable, stateMutability });
  }
  get selector() {
    return id(this.format("sighash")).substring(0, 10);
  }
  format(format) {
    if (format == null) {
      format = "sighash";
    }
    if (format === "json") {
      return JSON.stringify({
        type: "function",
        name: this.name,
        constant: this.constant,
        stateMutability: this.stateMutability !== "nonpayable" ? this.stateMutability : undefined,
        payable: this.payable,
        gas: this.gas != null ? this.gas : undefined,
        inputs: this.inputs.map((i) => JSON.parse(i.format(format))),
        outputs: this.outputs.map((o) => JSON.parse(o.format(format)))
      });
    }
    const result = [];
    if (format !== "sighash") {
      result.push("function");
    }
    result.push(this.name + joinParams(format, this.inputs));
    if (format !== "sighash") {
      if (this.stateMutability !== "nonpayable") {
        result.push(this.stateMutability);
      }
      if (this.outputs && this.outputs.length) {
        result.push("returns");
        result.push(joinParams(format, this.outputs));
      }
      if (this.gas != null) {
        result.push(`@${this.gas.toString()}`);
      }
    }
    return result.join(" ");
  }
  static getSelector(name, params) {
    params = (params || []).map((p) => ParamType.from(p));
    const fragment = new FunctionFragment(_guard3, name, "view", params, [], null);
    return fragment.selector;
  }
  static from(obj) {
    if (FunctionFragment.isFragment(obj)) {
      return obj;
    }
    if (typeof obj === "string") {
      try {
        return FunctionFragment.from(lex(obj));
      } catch (error) {
        assertArgument(false, "invalid function fragment", "obj", obj);
      }
    } else if (obj instanceof TokenString) {
      const name = consumeName("function", obj);
      const inputs = consumeParams(obj);
      const mutability = consumeMutability(obj);
      let outputs = [];
      if (consumeKeywords(obj, setify(["returns"])).has("returns")) {
        outputs = consumeParams(obj);
      }
      const gas = consumeGas(obj);
      consumeEoi(obj);
      return new FunctionFragment(_guard3, name, mutability, inputs, outputs, gas);
    }
    let stateMutability = obj.stateMutability;
    if (stateMutability == null) {
      stateMutability = "payable";
      if (typeof obj.constant === "boolean") {
        stateMutability = "view";
        if (!obj.constant) {
          stateMutability = "payable";
          if (typeof obj.payable === "boolean" && !obj.payable) {
            stateMutability = "nonpayable";
          }
        }
      } else if (typeof obj.payable === "boolean" && !obj.payable) {
        stateMutability = "nonpayable";
      }
    }
    return new FunctionFragment(_guard3, obj.name, stateMutability, obj.inputs ? obj.inputs.map(ParamType.from) : [], obj.outputs ? obj.outputs.map(ParamType.from) : [], obj.gas != null ? obj.gas : null);
  }
  static isFragment(value) {
    return value && value[internal] === FunctionFragmentInternal;
  }
}

class StructFragment extends NamedFragment {
  constructor(guard, name, inputs) {
    super(guard, "struct", name, inputs);
    Object.defineProperty(this, internal, { value: StructFragmentInternal });
  }
  format() {
    throw new Error("@TODO");
  }
  static from(obj) {
    if (typeof obj === "string") {
      try {
        return StructFragment.from(lex(obj));
      } catch (error) {
        assertArgument(false, "invalid struct fragment", "obj", obj);
      }
    } else if (obj instanceof TokenString) {
      const name = consumeName("struct", obj);
      const inputs = consumeParams(obj);
      consumeEoi(obj);
      return new StructFragment(_guard3, name, inputs);
    }
    return new StructFragment(_guard3, obj.name, obj.inputs ? obj.inputs.map(ParamType.from) : []);
  }
  static isFragment(value) {
    return value && value[internal] === StructFragmentInternal;
  }
}

// work/tripvault-room-server/node_modules/ethers/lib.esm/abi/abi-coder.js
var PanicReasons = new Map;
PanicReasons.set(0, "GENERIC_PANIC");
PanicReasons.set(1, "ASSERT_FALSE");
PanicReasons.set(17, "OVERFLOW");
PanicReasons.set(18, "DIVIDE_BY_ZERO");
PanicReasons.set(33, "ENUM_RANGE_ERROR");
PanicReasons.set(34, "BAD_STORAGE_DATA");
PanicReasons.set(49, "STACK_UNDERFLOW");
PanicReasons.set(50, "ARRAY_RANGE_ERROR");
PanicReasons.set(65, "OUT_OF_MEMORY");
PanicReasons.set(81, "UNINITIALIZED_FUNCTION_CALL");
var paramTypeBytes = new RegExp(/^bytes([0-9]*)$/);
var paramTypeNumber = new RegExp(/^(u?int)([0-9]*)$/);
var defaultCoder = null;
var defaultMaxInflation = 1024;
function getBuiltinCallException(action, tx, data, abiCoder) {
  let message = "missing revert data";
  let reason = null;
  const invocation = null;
  let revert = null;
  if (data) {
    message = "execution reverted";
    const bytes = getBytes(data);
    data = hexlify(data);
    if (bytes.length === 0) {
      message += " (no data present; likely require(false) occurred";
      reason = "require(false)";
    } else if (bytes.length % 32 !== 4) {
      message += " (could not decode reason; invalid data length)";
    } else if (hexlify(bytes.slice(0, 4)) === "0x08c379a0") {
      try {
        reason = abiCoder.decode(["string"], bytes.slice(4))[0];
        revert = {
          signature: "Error(string)",
          name: "Error",
          args: [reason]
        };
        message += `: ${JSON.stringify(reason)}`;
      } catch (error) {
        message += " (could not decode reason; invalid string data)";
      }
    } else if (hexlify(bytes.slice(0, 4)) === "0x4e487b71") {
      try {
        const code = Number(abiCoder.decode(["uint256"], bytes.slice(4))[0]);
        revert = {
          signature: "Panic(uint256)",
          name: "Panic",
          args: [code]
        };
        reason = `Panic due to ${PanicReasons.get(code) || "UNKNOWN"}(${code})`;
        message += `: ${reason}`;
      } catch (error) {
        message += " (could not decode panic code)";
      }
    } else {
      message += " (unknown custom error)";
    }
  }
  const transaction = {
    to: tx.to ? getAddress(tx.to) : null,
    data: tx.data || "0x"
  };
  if (tx.from) {
    transaction.from = getAddress(tx.from);
  }
  return makeError(message, "CALL_EXCEPTION", {
    action,
    data,
    reason,
    transaction,
    invocation,
    revert
  });
}

class AbiCoder {
  #getCoder(param) {
    if (param.isArray()) {
      return new ArrayCoder(this.#getCoder(param.arrayChildren), param.arrayLength, param.name);
    }
    if (param.isTuple()) {
      return new TupleCoder(param.components.map((c) => this.#getCoder(c)), param.name);
    }
    switch (param.baseType) {
      case "address":
        return new AddressCoder(param.name);
      case "bool":
        return new BooleanCoder(param.name);
      case "string":
        return new StringCoder(param.name);
      case "bytes":
        return new BytesCoder(param.name);
      case "":
        return new NullCoder(param.name);
    }
    let match = param.type.match(paramTypeNumber);
    if (match) {
      let size = parseInt(match[2] || "256");
      assertArgument(size !== 0 && size <= 256 && size % 8 === 0, "invalid " + match[1] + " bit length", "param", param);
      return new NumberCoder(size / 8, match[1] === "int", param.name);
    }
    match = param.type.match(paramTypeBytes);
    if (match) {
      let size = parseInt(match[1]);
      assertArgument(size !== 0 && size <= 32, "invalid bytes length", "param", param);
      return new FixedBytesCoder(size, param.name);
    }
    assertArgument(false, "invalid type", "type", param.type);
  }
  getDefaultValue(types) {
    const coders = types.map((type) => this.#getCoder(ParamType.from(type)));
    const coder = new TupleCoder(coders, "_");
    return coder.defaultValue();
  }
  encode(types, values) {
    assertArgumentCount(values.length, types.length, "types/values length mismatch");
    const coders = types.map((type) => this.#getCoder(ParamType.from(type)));
    const coder = new TupleCoder(coders, "_");
    const writer = new Writer;
    coder.encode(writer, values);
    return writer.data;
  }
  decode(types, data, loose) {
    const coders = types.map((type) => this.#getCoder(ParamType.from(type)));
    const coder = new TupleCoder(coders, "_");
    return coder.decode(new Reader(data, loose, defaultMaxInflation));
  }
  static _setDefaultMaxInflation(value) {
    assertArgument(typeof value === "number" && Number.isInteger(value), "invalid defaultMaxInflation factor", "value", value);
    defaultMaxInflation = value;
  }
  static defaultAbiCoder() {
    if (defaultCoder == null) {
      defaultCoder = new AbiCoder;
    }
    return defaultCoder;
  }
  static getBuiltinCallException(action, tx, data) {
    return getBuiltinCallException(action, tx, data, AbiCoder.defaultAbiCoder());
  }
}

// work/tripvault-room-server/node_modules/ethers/lib.esm/abi/interface.js
class LogDescription {
  fragment;
  name;
  signature;
  topic;
  args;
  constructor(fragment, topic, args) {
    const name = fragment.name, signature = fragment.format();
    defineProperties(this, {
      fragment,
      name,
      signature,
      topic,
      args
    });
  }
}

class TransactionDescription {
  fragment;
  name;
  args;
  signature;
  selector;
  value;
  constructor(fragment, selector, args, value) {
    const name = fragment.name, signature = fragment.format();
    defineProperties(this, {
      fragment,
      name,
      args,
      signature,
      selector,
      value
    });
  }
}

class ErrorDescription {
  fragment;
  name;
  args;
  signature;
  selector;
  constructor(fragment, selector, args) {
    const name = fragment.name, signature = fragment.format();
    defineProperties(this, {
      fragment,
      name,
      args,
      signature,
      selector
    });
  }
}

class Indexed {
  hash;
  _isIndexed;
  static isIndexed(value) {
    return !!(value && value._isIndexed);
  }
  constructor(hash) {
    defineProperties(this, { hash, _isIndexed: true });
  }
}
var PanicReasons2 = {
  "0": "generic panic",
  "1": "assert(false)",
  "17": "arithmetic overflow",
  "18": "division or modulo by zero",
  "33": "enum overflow",
  "34": "invalid encoded storage byte array accessed",
  "49": "out-of-bounds array access; popping on an empty array",
  "50": "out-of-bounds access of an array or bytesN",
  "65": "out of memory",
  "81": "uninitialized function"
};
var BuiltinErrors = {
  "0x08c379a0": {
    signature: "Error(string)",
    name: "Error",
    inputs: ["string"],
    reason: (message) => {
      return `reverted with reason string ${JSON.stringify(message)}`;
    }
  },
  "0x4e487b71": {
    signature: "Panic(uint256)",
    name: "Panic",
    inputs: ["uint256"],
    reason: (code) => {
      let reason = "unknown panic code";
      if (code >= 0 && code <= 255 && PanicReasons2[code.toString()]) {
        reason = PanicReasons2[code.toString()];
      }
      return `reverted with panic code 0x${code.toString(16)} (${reason})`;
    }
  }
};

class Interface {
  fragments;
  deploy;
  fallback;
  receive;
  #errors;
  #events;
  #functions;
  #abiCoder;
  constructor(fragments) {
    let abi = [];
    if (typeof fragments === "string") {
      abi = JSON.parse(fragments);
    } else {
      abi = fragments;
    }
    this.#functions = new Map;
    this.#errors = new Map;
    this.#events = new Map;
    const frags = [];
    for (const a of abi) {
      try {
        frags.push(Fragment.from(a));
      } catch (error) {
        console.log(`[Warning] Invalid Fragment ${JSON.stringify(a)}:`, error.message);
      }
    }
    defineProperties(this, {
      fragments: Object.freeze(frags)
    });
    let fallback = null;
    let receive = false;
    this.#abiCoder = this.getAbiCoder();
    this.fragments.forEach((fragment, index) => {
      let bucket;
      switch (fragment.type) {
        case "constructor":
          if (this.deploy) {
            console.log("duplicate definition - constructor");
            return;
          }
          defineProperties(this, { deploy: fragment });
          return;
        case "fallback":
          if (fragment.inputs.length === 0) {
            receive = true;
          } else {
            assertArgument(!fallback || fragment.payable !== fallback.payable, "conflicting fallback fragments", `fragments[${index}]`, fragment);
            fallback = fragment;
            receive = fallback.payable;
          }
          return;
        case "function":
          bucket = this.#functions;
          break;
        case "event":
          bucket = this.#events;
          break;
        case "error":
          bucket = this.#errors;
          break;
        default:
          return;
      }
      const signature = fragment.format();
      if (bucket.has(signature)) {
        return;
      }
      bucket.set(signature, fragment);
    });
    if (!this.deploy) {
      defineProperties(this, {
        deploy: ConstructorFragment.from("constructor()")
      });
    }
    defineProperties(this, { fallback, receive });
  }
  format(minimal) {
    const format = minimal ? "minimal" : "full";
    const abi = this.fragments.map((f) => f.format(format));
    return abi;
  }
  formatJson() {
    const abi = this.fragments.map((f) => f.format("json"));
    return JSON.stringify(abi.map((j) => JSON.parse(j)));
  }
  getAbiCoder() {
    return AbiCoder.defaultAbiCoder();
  }
  #getFunction(key, values, forceUnique) {
    if (isHexString(key)) {
      const selector = key.toLowerCase();
      for (const fragment of this.#functions.values()) {
        if (selector === fragment.selector) {
          return fragment;
        }
      }
      return null;
    }
    if (key.indexOf("(") === -1) {
      const matching = [];
      for (const [name, fragment] of this.#functions) {
        if (name.split("(")[0] === key) {
          matching.push(fragment);
        }
      }
      if (values) {
        const lastValue = values.length > 0 ? values[values.length - 1] : null;
        let valueLength = values.length;
        let allowOptions = true;
        if (Typed.isTyped(lastValue) && lastValue.type === "overrides") {
          allowOptions = false;
          valueLength--;
        }
        for (let i = matching.length - 1;i >= 0; i--) {
          const inputs = matching[i].inputs.length;
          if (inputs !== valueLength && (!allowOptions || inputs !== valueLength - 1)) {
            matching.splice(i, 1);
          }
        }
        for (let i = matching.length - 1;i >= 0; i--) {
          const inputs = matching[i].inputs;
          for (let j = 0;j < values.length; j++) {
            if (!Typed.isTyped(values[j])) {
              continue;
            }
            if (j >= inputs.length) {
              if (values[j].type === "overrides") {
                continue;
              }
              matching.splice(i, 1);
              break;
            }
            if (values[j].type !== inputs[j].baseType) {
              matching.splice(i, 1);
              break;
            }
          }
        }
      }
      if (matching.length === 1 && values && values.length !== matching[0].inputs.length) {
        const lastArg = values[values.length - 1];
        if (lastArg == null || Array.isArray(lastArg) || typeof lastArg !== "object") {
          matching.splice(0, 1);
        }
      }
      if (matching.length === 0) {
        return null;
      }
      if (matching.length > 1 && forceUnique) {
        const matchStr = matching.map((m) => JSON.stringify(m.format())).join(", ");
        assertArgument(false, `ambiguous function description (i.e. matches ${matchStr})`, "key", key);
      }
      return matching[0];
    }
    const result = this.#functions.get(FunctionFragment.from(key).format());
    if (result) {
      return result;
    }
    return null;
  }
  getFunctionName(key) {
    const fragment = this.#getFunction(key, null, false);
    assertArgument(fragment, "no matching function", "key", key);
    return fragment.name;
  }
  hasFunction(key) {
    return !!this.#getFunction(key, null, false);
  }
  getFunction(key, values) {
    return this.#getFunction(key, values || null, true);
  }
  forEachFunction(callback) {
    const names = Array.from(this.#functions.keys());
    names.sort((a, b) => a.localeCompare(b));
    for (let i = 0;i < names.length; i++) {
      const name = names[i];
      callback(this.#functions.get(name), i);
    }
  }
  #getEvent(key, values, forceUnique) {
    if (isHexString(key)) {
      const eventTopic = key.toLowerCase();
      for (const fragment of this.#events.values()) {
        if (eventTopic === fragment.topicHash) {
          return fragment;
        }
      }
      return null;
    }
    if (key.indexOf("(") === -1) {
      const matching = [];
      for (const [name, fragment] of this.#events) {
        if (name.split("(")[0] === key) {
          matching.push(fragment);
        }
      }
      if (values) {
        for (let i = matching.length - 1;i >= 0; i--) {
          if (matching[i].inputs.length < values.length) {
            matching.splice(i, 1);
          }
        }
        for (let i = matching.length - 1;i >= 0; i--) {
          const inputs = matching[i].inputs;
          for (let j = 0;j < values.length; j++) {
            if (!Typed.isTyped(values[j])) {
              continue;
            }
            if (values[j].type !== inputs[j].baseType) {
              matching.splice(i, 1);
              break;
            }
          }
        }
      }
      if (matching.length === 0) {
        return null;
      }
      if (matching.length > 1 && forceUnique) {
        const matchStr = matching.map((m) => JSON.stringify(m.format())).join(", ");
        assertArgument(false, `ambiguous event description (i.e. matches ${matchStr})`, "key", key);
      }
      return matching[0];
    }
    const result = this.#events.get(EventFragment.from(key).format());
    if (result) {
      return result;
    }
    return null;
  }
  getEventName(key) {
    const fragment = this.#getEvent(key, null, false);
    assertArgument(fragment, "no matching event", "key", key);
    return fragment.name;
  }
  hasEvent(key) {
    return !!this.#getEvent(key, null, false);
  }
  getEvent(key, values) {
    return this.#getEvent(key, values || null, true);
  }
  forEachEvent(callback) {
    const names = Array.from(this.#events.keys());
    names.sort((a, b) => a.localeCompare(b));
    for (let i = 0;i < names.length; i++) {
      const name = names[i];
      callback(this.#events.get(name), i);
    }
  }
  getError(key, values) {
    if (isHexString(key)) {
      const selector = key.toLowerCase();
      if (BuiltinErrors[selector]) {
        return ErrorFragment.from(BuiltinErrors[selector].signature);
      }
      for (const fragment of this.#errors.values()) {
        if (selector === fragment.selector) {
          return fragment;
        }
      }
      return null;
    }
    if (key.indexOf("(") === -1) {
      const matching = [];
      for (const [name, fragment] of this.#errors) {
        if (name.split("(")[0] === key) {
          matching.push(fragment);
        }
      }
      if (matching.length === 0) {
        if (key === "Error") {
          return ErrorFragment.from("error Error(string)");
        }
        if (key === "Panic") {
          return ErrorFragment.from("error Panic(uint256)");
        }
        return null;
      } else if (matching.length > 1) {
        const matchStr = matching.map((m) => JSON.stringify(m.format())).join(", ");
        assertArgument(false, `ambiguous error description (i.e. ${matchStr})`, "name", key);
      }
      return matching[0];
    }
    key = ErrorFragment.from(key).format();
    if (key === "Error(string)") {
      return ErrorFragment.from("error Error(string)");
    }
    if (key === "Panic(uint256)") {
      return ErrorFragment.from("error Panic(uint256)");
    }
    const result = this.#errors.get(key);
    if (result) {
      return result;
    }
    return null;
  }
  forEachError(callback) {
    const names = Array.from(this.#errors.keys());
    names.sort((a, b) => a.localeCompare(b));
    for (let i = 0;i < names.length; i++) {
      const name = names[i];
      callback(this.#errors.get(name), i);
    }
  }
  _decodeParams(params, data) {
    return this.#abiCoder.decode(params, data);
  }
  _encodeParams(params, values) {
    return this.#abiCoder.encode(params, values);
  }
  encodeDeploy(values) {
    return this._encodeParams(this.deploy.inputs, values || []);
  }
  decodeErrorResult(fragment, data) {
    if (typeof fragment === "string") {
      const f = this.getError(fragment);
      assertArgument(f, "unknown error", "fragment", fragment);
      fragment = f;
    }
    assertArgument(dataSlice(data, 0, 4) === fragment.selector, `data signature does not match error ${fragment.name}.`, "data", data);
    return this._decodeParams(fragment.inputs, dataSlice(data, 4));
  }
  encodeErrorResult(fragment, values) {
    if (typeof fragment === "string") {
      const f = this.getError(fragment);
      assertArgument(f, "unknown error", "fragment", fragment);
      fragment = f;
    }
    return concat([
      fragment.selector,
      this._encodeParams(fragment.inputs, values || [])
    ]);
  }
  decodeFunctionData(fragment, data) {
    if (typeof fragment === "string") {
      const f = this.getFunction(fragment);
      assertArgument(f, "unknown function", "fragment", fragment);
      fragment = f;
    }
    assertArgument(dataSlice(data, 0, 4) === fragment.selector, `data signature does not match function ${fragment.name}.`, "data", data);
    return this._decodeParams(fragment.inputs, dataSlice(data, 4));
  }
  encodeFunctionData(fragment, values) {
    if (typeof fragment === "string") {
      const f = this.getFunction(fragment);
      assertArgument(f, "unknown function", "fragment", fragment);
      fragment = f;
    }
    return concat([
      fragment.selector,
      this._encodeParams(fragment.inputs, values || [])
    ]);
  }
  decodeFunctionResult(fragment, data) {
    if (typeof fragment === "string") {
      const f = this.getFunction(fragment);
      assertArgument(f, "unknown function", "fragment", fragment);
      fragment = f;
    }
    let message = "invalid length for result data";
    const bytes = getBytesCopy(data);
    if (bytes.length % 32 === 0) {
      try {
        return this.#abiCoder.decode(fragment.outputs, bytes);
      } catch (error) {
        message = "could not decode result data";
      }
    }
    assert(false, message, "BAD_DATA", {
      value: hexlify(bytes),
      info: { method: fragment.name, signature: fragment.format() }
    });
  }
  makeError(_data, tx) {
    const data = getBytes(_data, "data");
    const error = AbiCoder.getBuiltinCallException("call", tx, data);
    const customPrefix = "execution reverted (unknown custom error)";
    if (error.message.startsWith(customPrefix)) {
      const selector = hexlify(data.slice(0, 4));
      const ef = this.getError(selector);
      if (ef) {
        try {
          const args = this.#abiCoder.decode(ef.inputs, data.slice(4));
          error.revert = {
            name: ef.name,
            signature: ef.format(),
            args
          };
          error.reason = error.revert.signature;
          error.message = `execution reverted: ${error.reason}`;
        } catch (e) {
          error.message = `execution reverted (coult not decode custom error)`;
        }
      }
    }
    const parsed = this.parseTransaction(tx);
    if (parsed) {
      error.invocation = {
        method: parsed.name,
        signature: parsed.signature,
        args: parsed.args
      };
    }
    return error;
  }
  encodeFunctionResult(fragment, values) {
    if (typeof fragment === "string") {
      const f = this.getFunction(fragment);
      assertArgument(f, "unknown function", "fragment", fragment);
      fragment = f;
    }
    return hexlify(this.#abiCoder.encode(fragment.outputs, values || []));
  }
  encodeFilterTopics(fragment, values) {
    if (typeof fragment === "string") {
      const f = this.getEvent(fragment);
      assertArgument(f, "unknown event", "eventFragment", fragment);
      fragment = f;
    }
    assert(values.length <= fragment.inputs.length, `too many arguments for ${fragment.format()}`, "UNEXPECTED_ARGUMENT", { count: values.length, expectedCount: fragment.inputs.length });
    const topics = [];
    if (!fragment.anonymous) {
      topics.push(fragment.topicHash);
    }
    const encodeTopic = (param, value) => {
      if (param.type === "string") {
        return id(value);
      } else if (param.type === "bytes") {
        return keccak256(hexlify(value));
      }
      if (param.type === "bool" && typeof value === "boolean") {
        value = value ? "0x01" : "0x00";
      } else if (param.type.match(/^u?int/)) {
        value = toBeHex(value);
      } else if (param.type.match(/^bytes/)) {
        value = zeroPadBytes(value, 32);
      } else if (param.type === "address") {
        this.#abiCoder.encode(["address"], [value]);
      }
      return zeroPadValue(hexlify(value), 32);
    };
    values.forEach((value, index) => {
      const param = fragment.inputs[index];
      if (!param.indexed) {
        assertArgument(value == null, "cannot filter non-indexed parameters; must be null", "contract." + param.name, value);
        return;
      }
      if (value == null) {
        topics.push(null);
      } else if (param.baseType === "array" || param.baseType === "tuple") {
        assertArgument(false, "filtering with tuples or arrays not supported", "contract." + param.name, value);
      } else if (Array.isArray(value)) {
        topics.push(value.map((value) => encodeTopic(param, value)));
      } else {
        topics.push(encodeTopic(param, value));
      }
    });
    while (topics.length && topics[topics.length - 1] === null) {
      topics.pop();
    }
    return topics;
  }
  encodeEventLog(fragment, values) {
    if (typeof fragment === "string") {
      const f = this.getEvent(fragment);
      assertArgument(f, "unknown event", "eventFragment", fragment);
      fragment = f;
    }
    const topics = [];
    const dataTypes = [];
    const dataValues = [];
    if (!fragment.anonymous) {
      topics.push(fragment.topicHash);
    }
    assertArgument(values.length === fragment.inputs.length, "event arguments/values mismatch", "values", values);
    fragment.inputs.forEach((param, index) => {
      const value = values[index];
      if (param.indexed) {
        if (param.type === "string") {
          topics.push(id(value));
        } else if (param.type === "bytes") {
          topics.push(keccak256(value));
        } else if (param.baseType === "tuple" || param.baseType === "array") {
          throw new Error("not implemented");
        } else {
          topics.push(this.#abiCoder.encode([param.type], [value]));
        }
      } else {
        dataTypes.push(param);
        dataValues.push(value);
      }
    });
    return {
      data: this.#abiCoder.encode(dataTypes, dataValues),
      topics
    };
  }
  decodeEventLog(fragment, data, topics) {
    if (typeof fragment === "string") {
      const f = this.getEvent(fragment);
      assertArgument(f, "unknown event", "eventFragment", fragment);
      fragment = f;
    }
    if (topics != null && !fragment.anonymous) {
      const eventTopic = fragment.topicHash;
      assertArgument(isHexString(topics[0], 32) && topics[0].toLowerCase() === eventTopic, "fragment/topic mismatch", "topics[0]", topics[0]);
      topics = topics.slice(1);
    }
    const indexed = [];
    const nonIndexed = [];
    const dynamic = [];
    fragment.inputs.forEach((param, index) => {
      if (param.indexed) {
        if (param.type === "string" || param.type === "bytes" || param.baseType === "tuple" || param.baseType === "array") {
          indexed.push(ParamType.from({ type: "bytes32", name: param.name }));
          dynamic.push(true);
        } else {
          indexed.push(param);
          dynamic.push(false);
        }
      } else {
        nonIndexed.push(param);
        dynamic.push(false);
      }
    });
    const resultIndexed = topics != null ? this.#abiCoder.decode(indexed, concat(topics)) : null;
    const resultNonIndexed = this.#abiCoder.decode(nonIndexed, data, true);
    const values = [];
    const keys = [];
    let nonIndexedIndex = 0, indexedIndex = 0;
    fragment.inputs.forEach((param, index) => {
      let value = null;
      if (param.indexed) {
        if (resultIndexed == null) {
          value = new Indexed(null);
        } else if (dynamic[index]) {
          value = new Indexed(resultIndexed[indexedIndex++]);
        } else {
          try {
            value = resultIndexed[indexedIndex++];
          } catch (error) {
            value = error;
          }
        }
      } else {
        try {
          value = resultNonIndexed[nonIndexedIndex++];
        } catch (error) {
          value = error;
        }
      }
      values.push(value);
      keys.push(param.name || null);
    });
    return Result.fromItems(values, keys);
  }
  parseTransaction(tx) {
    const data = getBytes(tx.data, "tx.data");
    const value = getBigInt(tx.value != null ? tx.value : 0, "tx.value");
    const fragment = this.getFunction(hexlify(data.slice(0, 4)));
    if (!fragment) {
      return null;
    }
    const args = this.#abiCoder.decode(fragment.inputs, data.slice(4));
    return new TransactionDescription(fragment, fragment.selector, args, value);
  }
  parseCallResult(data) {
    throw new Error("@TODO");
  }
  parseLog(log) {
    const fragment = this.getEvent(log.topics[0]);
    if (!fragment || fragment.anonymous) {
      return null;
    }
    return new LogDescription(fragment, fragment.topicHash, this.decodeEventLog(fragment, log.data, log.topics));
  }
  parseError(data) {
    const hexData = hexlify(data);
    const fragment = this.getError(dataSlice(hexData, 0, 4));
    if (!fragment) {
      return null;
    }
    const args = this.#abiCoder.decode(fragment.inputs, dataSlice(hexData, 4));
    return new ErrorDescription(fragment, fragment.selector, args);
  }
  static from(value) {
    if (value instanceof Interface) {
      return value;
    }
    if (typeof value === "string") {
      return new Interface(JSON.parse(value));
    }
    if (typeof value.formatJson === "function") {
      return new Interface(value.formatJson());
    }
    if (typeof value.format === "function") {
      return new Interface(value.format("json"));
    }
    return new Interface(value);
  }
}
// work/tripvault-room-funding.js
function roomFundingShortfalls(trip, funding, draft) {
  const net = new Map(trip.members.map((member) => [member.id, 0]));
  const bills = draft ? [...trip.bills, draft] : trip.bills;
  for (const bill of bills) {
    if (bill.status === "rejected")
      continue;
    const count = bill.participants.length;
    const isCustom = bill.splitType === "custom" && bill.customShares && typeof bill.customShares === "object";
    const share = Math.floor(bill.amount / count);
    const remainder = bill.amount % count;
    const payerShare = bill.participants.indexOf(bill.payer);
    if (bill.status === "approved") {
      net.set(bill.payer, net.get(bill.payer) + bill.amount);
    }
    for (const [index, id] of bill.participants.entries()) {
      if (bill.status !== "approved" && index === payerShare)
        continue;
      const amountOwed = isCustom ? Math.round(Number(bill.customShares[id])) || 0 : share + (index < remainder ? 1 : 0);
      net.set(id, net.get(id) - amountOwed);
    }
  }
  return trip.members.map((member, index) => {
    const debt = funding.rate ? Math.ceil(Math.max(0, -net.get(member.id)) * 1e6 / funding.rate) : 0;
    const required = Math.max(trip.minimumUnits, debt);
    return { id: member.id, units: required - funding.balances[index] };
  }).filter((item) => item.units > 0);
}

// work/tripvault-room-server/entry.js
var CONTRACT = { runtime: "608060405234801561001057600080fd5b50600436106100cf5760003560e01c80639711715a1161008c578063b6b55f2511610066578063b6b55f251461019f578063c70d484f146101b2578063e1aa1bcc146101c5578063f92a53f2146101ce57600080fd5b80639711715a1461016757806397b7d8d714610184578063987757dd1461018c57600080fd5b8063190da595146100d45780632e1a7d4d146100f157806339e78fc7146101065780634e71d92d146101195780634ec799371461012157806389a3027114610134575b600080fd5b6100de62093a8081565b6040519081526020015b60405180910390f35b6101046100ff3660046110e8565b6101e3565b005b610104610114366004611101565b610286565b610104610400565b61010461012f366004611134565b6104ae565b61014f735425890298aed601595a70ab815c96711a31bc6581565b6040516001600160a01b0390911681526020016100e8565b61016f610576565b6040516100e8999897969594939291906111d4565b6101046107e2565b61010461019a3660046110e8565b61088c565b6101046101ad3660046110e8565b610ac9565b6101046101c036600461128e565b610c74565b6100de60095481565b6101d6610e6a565b6040516100e89190611305565b3360009081526002602052604090205460ff16610212576040516282b42960e81b815260040160405180910390fd5b6007544210158061022557506008544210155b1561024357604051636670965b60e11b815260040160405180910390fd5b61024d3382610f28565b60405181815233907f7084f5476618d8e60b11ef0d7d3f06914655adb8793e28ff7f018d4c76d505d5906020015b60405180910390a250565b3360009081526002602052604090205460ff166102b5576040516282b42960e81b815260040160405180910390fd5b6102bd611052565b8015806102cc5750600c548114155b156102ea576040516321f2425960e01b815260040160405180910390fd5b60005b6001548110156103f257336001600160a01b0316600182815481106103145761031461131f565b6000918252602090912001546001600160a01b0316036103ea57600080600d83815481106103445761034461131f565b90600052602060002001541261035b576000610382565b600d828154811061036e5761036e61131f565b90600052602060002001546103829061134b565b9050600081600a54116103955781610399565b600a545b3360009081526003602052604090205490915081811015806103c457506103c08183611367565b8614155b156103e25760405163162908e360e11b815260040160405180910390fd5b5050506103f2565b6001016102ed565b506103fc82610ac9565b5050565b3360009081526002602052604090205460ff1661042f576040516282b42960e81b815260040160405180910390fd5b600e5460ff16158015610443575060095442105b1561046157604051636670965b60e11b815260040160405180910390fd5b336000818152600360205260409020549061047c9082610f28565b60405181815233907fd8138f8a3f377c5259ca548e70e4c2de94f129f5a11036a15b69513cba2b426a9060200161027b565b3360009081526002602052604090205460ff166104dd576040516282b42960e81b815260040160405180910390fd5b6104e5611052565b8115806104f45750600c548214155b15610512576040516321f2425960e01b815260040160405180910390fd5b8061051e576000610520565b815b336000818152600560205260409081902092909255905183907fa84a380d7909dd30db05e5cd1fdba84e5ff7eaf410ce13e3c473b7b30ed9e6539061056a90851515815260200190565b60405180910390a35050565b606080606080600080600080600060018054806020026020016040519081016040528092919081815260200182805480156105da57602002820191906000526020600020905b81546001600160a01b031681526001909101906020018083116105bc575b5050600154939c50505067ffffffffffffffff82111590506105fe576105fe611380565b604051908082528060200260200182016040528015610627578160200160208202803683370190505b5060015490985067ffffffffffffffff81111561064657610646611380565b60405190808252806020026020018201604052801561066f578160200160208202803683370190505b50955060005b6001548110156107515760036000600183815481106106965761069661131f565b60009182526020808320909101546001600160a01b0316835282019290925260400190205489518a90839081106106cf576106cf61131f565b6020908102919091010152600c54158015906107275750600c5460056000600184815481106107005761070061131f565b60009182526020808320909101546001600160a01b03168352820192909252604001902054145b8782815181106107395761073961131f565b91151560209283029190910190910152600101610675565b508888600d88600c54600754600854600a54600e60009054906101000a900460ff16868054806020026020016040519081016040528092919081815260200182805480156107be57602002820191906000526020600020905b8154815260200190600101908083116107aa575b50505050509650985098509850985098509850985098509850909192939495969798565b6000546001600160a01b0316331461080c576040516282b42960e81b815260040160405180910390fd5b600e5460ff168061081f57506008544210155b1561083d57604051636670965b60e11b815260040160405180910390fd5b4260088190556108519062093a8090611396565b6009556008546040519081527f1b099693c249db2feed5e2b631cc7d36dc0fd031c2f52a58595ecd8d0c7f5a4a9060200160405180910390a1565b6000546001600160a01b031633146108b6576040516282b42960e81b815260040160405180910390fd5b6108be611052565b8015806108cd5750600c548114155b156108eb576040516321f2425960e01b815260040160405180910390fd5b60005b600154811015610a8d5760006001828154811061090d5761090d61131f565b60009182526020808320909101546001600160a01b0316808352600590915260409091205490915083146109645760405163d4e69ce760e01b81526001600160a01b03821660048201526024015b60405180910390fd5b6001600160a01b038116600090815260036020526040812054600d8054919291829190869081106109975761099761131f565b9060005260206000200154126109ae5760006109d5565b600d84815481106109c1576109c161131f565b90600052602060002001546109d59061134b565b9050600081600a54116109e857816109ec565b600a545b905080831015610a285760405163f589588b60e01b81526001600160a01b0385166004820152602481018290526044810184905260640161095b565b6000600d8681548110610a3d57610a3d61131f565b906000526020600020015484610a5391906113a9565b6001600160a01b03909516600090815260036020908152604080832088905560049091529020949094555050600190920191506108ee9050565b50600e805460ff1916600117905560405181907fd647759a2f3297cba8e32e398356f87d2583ecaaad1741fc2d5f7d67fd86198490600090a250565b3360009081526002602052604090205460ff16610af8576040516282b42960e81b815260040160405180910390fd5b600e5460ff1680610b0b57506009544210155b15610b2957604051636670965b60e11b815260040160405180910390fd5b801580610b485750600654610b4590661fffffffffffff611367565b81115b15610b665760405163162908e360e11b815260040160405180910390fd5b3360009081526003602052604081208054839290610b85908490611396565b925050819055508060066000828254610b9e9190611396565b90915550506040516323b872dd60e01b815233600482015230602482015260448101829052735425890298aed601595a70ab815c96711a31bc65906323b872dd906064016020604051808303816000875af1158015610c01573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610c2591906113d1565b610c42576040516312171d8360e31b815260040160405180910390fd5b60405181815233907f2da466a7b24304f47e87fa2e1e5a81b9831ce54fec19055ce277ca2f39ba42c49060200161027b565b6000546001600160a01b03163314610c9e576040516282b42960e81b815260040160405180910390fd5b610ca6611052565b6001548114610cc8576040516321f2425960e01b815260040160405180910390fd5b6000805b82811015610d7357610ce4661fffffffffffff61134b565b848483818110610cf657610cf661131f565b905060200201351280610d275750661fffffffffffff848483818110610d1e57610d1e61131f565b90506020020135135b15610d45576040516321f2425960e01b815260040160405180910390fd5b838382818110610d5757610d5761131f565b9050602002013582610d6991906113a9565b9150600101610ccc565b508015610d93576040516321f2425960e01b815260040160405180910390fd5b600b60008154610da2906113ee565b90915550610db2600d8484611091565b50600b54604051610dcb91309186908690602001611407565b60408051808303601f190181528282528051602091820120600c8190553360009081526005835292909220829055600b54835290917fe7b042f807192ab71e679eb4a22e68c98199b7ab4de7e1d3c5a8f2889d6e971f910160405180910390a2600c54604051600181523391907fa84a380d7909dd30db05e5cd1fdba84e5ff7eaf410ce13e3c473b7b30ed9e6539060200160405180910390a3505050565b60015460609067ffffffffffffffff811115610e8857610e88611380565b604051908082528060200260200182016040528015610eb1578160200160208202803683370190505b50905060005b600154811015610f24576004600060018381548110610ed857610ed861131f565b60009182526020808320909101546001600160a01b031683528201929092526040019020548251839083908110610f1157610f1161131f565b6020908102919091010152600101610eb7565b5090565b801580610f4c57506001600160a01b03821660009081526003602052604090205481115b15610f6a5760405163162908e360e11b815260040160405180910390fd5b6001600160a01b03821660009081526003602052604081208054839290610f92908490611367565b925050819055508060066000828254610fab9190611367565b909155505060405163a9059cbb60e01b81526001600160a01b038316600482015260248101829052735425890298aed601595a70ab815c96711a31bc659063a9059cbb906044016020604051808303816000875af1158015611011573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061103591906113d1565b6103fc576040516312171d8360e31b815260040160405180910390fd5b600e5460ff1680611064575060085442105b8061107157506009544210155b1561108f57604051636670965b60e11b815260040160405180910390fd5b565b8280548282559060005260206000209081019282156110cc579160200282015b828111156110cc5782358255916020019190600101906110b1565b50610f249291505b80821115610f2457600081556001016110d4565b6000602082840312156110fa57600080fd5b5035919050565b6000806040838503121561111457600080fd5b50508035926020909101359150565b801515811461113157600080fd5b50565b6000806040838503121561114757600080fd5b82359150602083013561115981611123565b809150509250929050565b600081518084526020840193506020830160005b82811015611196578151865260209586019590910190600101611178565b5093949350505050565b600081518084526020840193506020830160005b8281101561119657815115158652602095860195909101906001016111b4565b6101208082528a5190820181905260009060208c0190610140840190835b818110156112195783516001600160a01b03168352602093840193909201916001016111f2565b5050838103602085015261122d818d611164565b9150508281036040840152611242818b611164565b90508281036060840152611256818a6111a0565b9150508660808301528560a08301528460c08301528360e083015261128061010083018415159052565b9a9950505050505050505050565b600080602083850312156112a157600080fd5b823567ffffffffffffffff8111156112b857600080fd5b8301601f810185136112c957600080fd5b803567ffffffffffffffff8111156112e057600080fd5b8560208260051b84010111156112f557600080fd5b6020919091019590945092505050565b6020815260006113186020830184611164565b9392505050565b634e487b7160e01b600052603260045260246000fd5b634e487b7160e01b600052601160045260246000fd5b6000600160ff1b820161136057611360611335565b5060000390565b8181038181111561137a5761137a611335565b92915050565b634e487b7160e01b600052604160045260246000fd5b8082018082111561137a5761137a611335565b80820182811260008312801582168215821617156113c9576113c9611335565b505092915050565b6000602082840312156113e357600080fd5b815161131881611123565b60006001820161140057611400611335565b5060010190565b6001600160a01b038516815260208101849052606060408201819052810182905260008360808301825b8581101561144f578235825260209283019290910190600101611431565b5097965050505050505056fea264697066735822122072bc771edc000c5e30ca984cec7c0175e7e44423c14958dd0fd1f6f54a6b995764736f6c634300081c0033", legacyRuntime: "608060405234801561001057600080fd5b506004361061009e5760003560e01c806389a302711161006657806389a30271146101035780639711715a14610136578063987757dd14610153578063b6b55f2514610166578063c70d484f1461017957600080fd5b8063190da595146100a35780632e1a7d4d146100c057806339e78fc7146100d55780634e71d92d146100e85780634ec79937146100f0575b600080fd5b6100ad62093a8081565b6040519081526020015b60405180910390f35b6100d36100ce366004610f3a565b61018c565b005b6100d36100e3366004610f53565b610220565b6100d361039a565b6100d36100fe366004610f86565b610456565b61011e735425890298aed601595a70ab815c96711a31bc6581565b6040516001600160a01b0390911681526020016100b7565b61013e61051e565b6040516100b799989796959493929190611026565b6100d3610161366004610f3a565b61078a565b6100d3610174366004610f3a565b6109b4565b6100d36101873660046110e0565b610b6d565b3360009081526002602052604090205460ff166101bb576040516282b42960e81b815260040160405180910390fd5b60065442106101dd57604051636670965b60e11b815260040160405180910390fd5b6101e73382610d63565b60405181815233907f7084f5476618d8e60b11ef0d7d3f06914655adb8793e28ff7f018d4c76d505d5906020015b60405180910390a250565b3360009081526002602052604090205460ff1661024f576040516282b42960e81b815260040160405180910390fd5b610257610e8d565b8015806102665750600a548114155b15610284576040516321f2425960e01b815260040160405180910390fd5b60005b60015481101561038c57336001600160a01b0316600182815481106102ae576102ae611157565b6000918252602090912001546001600160a01b03160361038457600080600b83815481106102de576102de611157565b9060005260206000200154126102f557600061031c565b600b828154811061030857610308611157565b906000526020600020015461031c90611183565b90506000816008541161032f5781610333565b6008545b33600090815260036020526040902054909150818110158061035e575061035a818361119f565b8614155b1561037c5760405163162908e360e11b815260040160405180910390fd5b50505061038c565b600101610287565b50610396826109b4565b5050565b3360009081526002602052604090205460ff166103c9576040516282b42960e81b815260040160405180910390fd5b600c5460ff161580156103eb575062093a806007546103e891906111b8565b42105b1561040957604051636670965b60e11b815260040160405180910390fd5b33600081815260036020526040902054906104249082610d63565b60405181815233907fd8138f8a3f377c5259ca548e70e4c2de94f129f5a11036a15b69513cba2b426a90602001610215565b3360009081526002602052604090205460ff16610485576040516282b42960e81b815260040160405180910390fd5b61048d610e8d565b81158061049c5750600a548214155b156104ba576040516321f2425960e01b815260040160405180910390fd5b806104c65760006104c8565b815b336000818152600460205260409081902092909255905183907fa84a380d7909dd30db05e5cd1fdba84e5ff7eaf410ce13e3c473b7b30ed9e6539061051290851515815260200190565b60405180910390a35050565b6060806060806000806000806000600180548060200260200160405190810160405280929190818152602001828054801561058257602002820191906000526020600020905b81546001600160a01b03168152600190910190602001808311610564575b5050600154939c50505067ffffffffffffffff82111590506105a6576105a66111cb565b6040519080825280602002602001820160405280156105cf578160200160208202803683370190505b5060015490985067ffffffffffffffff8111156105ee576105ee6111cb565b604051908082528060200260200182016040528015610617578160200160208202803683370190505b50955060005b6001548110156106f957600360006001838154811061063e5761063e611157565b60009182526020808320909101546001600160a01b0316835282019290925260400190205489518a908390811061067757610677611157565b6020908102919091010152600a54158015906106cf5750600a5460046000600184815481106106a8576106a8611157565b60009182526020808320909101546001600160a01b03168352820192909252604001902054145b8782815181106106e1576106e1611157565b9115156020928302919091019091015260010161061d565b508888600b88600a54600654600754600854600c60009054906101000a900460ff168680548060200260200160405190810160405280929190818152602001828054801561076657602002820191906000526020600020905b815481526020019060010190808311610752575b50505050509650985098509850985098509850985098509850909192939495969798565b6000546001600160a01b031633146107b4576040516282b42960e81b815260040160405180910390fd5b6107bc610e8d565b8015806107cb5750600a548114155b156107e9576040516321f2425960e01b815260040160405180910390fd5b60005b6001548110156109785760006001828154811061080b5761080b611157565b60009182526020808320909101546001600160a01b0316808352600490915260409091205490915083146108625760405163d4e69ce760e01b81526001600160a01b03821660048201526024015b60405180910390fd5b6001600160a01b038116600090815260036020526040812054600b80549192918291908690811061089557610895611157565b9060005260206000200154126108ac5760006108d3565b600b84815481106108bf576108bf611157565b90600052602060002001546108d390611183565b9050600081600854116108e657816108ea565b6008545b9050808310156109265760405163f589588b60e01b81526001600160a01b03851660048201526024810182905260448101849052606401610859565b600b858154811061093957610939611157565b90600052602060002001548361094f91906111e1565b6001600160a01b03949094166000908152600360205260409020939093555050506001016107ec565b50600c805460ff1916600117905560405181907fd647759a2f3297cba8e32e398356f87d2583ecaaad1741fc2d5f7d67fd86198490600090a250565b3360009081526002602052604090205460ff166109e3576040516282b42960e81b815260040160405180910390fd5b600c5460ff1680610a04575062093a80600754610a0091906111b8565b4210155b15610a2257604051636670965b60e11b815260040160405180910390fd5b801580610a415750600554610a3e90661fffffffffffff61119f565b81115b15610a5f5760405163162908e360e11b815260040160405180910390fd5b3360009081526003602052604081208054839290610a7e9084906111b8565b925050819055508060056000828254610a9791906111b8565b90915550506040516323b872dd60e01b815233600482015230602482015260448101829052735425890298aed601595a70ab815c96711a31bc65906323b872dd906064016020604051808303816000875af1158015610afa573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610b1e9190611209565b610b3b576040516312171d8360e31b815260040160405180910390fd5b60405181815233907f2da466a7b24304f47e87fa2e1e5a81b9831ce54fec19055ce277ca2f39ba42c490602001610215565b6000546001600160a01b03163314610b97576040516282b42960e81b815260040160405180910390fd5b610b9f610e8d565b6001548114610bc1576040516321f2425960e01b815260040160405180910390fd5b6000805b82811015610c6c57610bdd661fffffffffffff611183565b848483818110610bef57610bef611157565b905060200201351280610c205750661fffffffffffff848483818110610c1757610c17611157565b90506020020135135b15610c3e576040516321f2425960e01b815260040160405180910390fd5b838382818110610c5057610c50611157565b9050602002013582610c6291906111e1565b9150600101610bc5565b508015610c8c576040516321f2425960e01b815260040160405180910390fd5b600960008154610c9b9061122d565b90915550610cab600b8484610eda565b50600954604051610cc491309186908690602001611246565b60408051808303601f190181528282528051602091820120600a8190553360009081526004835292909220829055600954835290917fe7b042f807192ab71e679eb4a22e68c98199b7ab4de7e1d3c5a8f2889d6e971f910160405180910390a2600a54604051600181523391907fa84a380d7909dd30db05e5cd1fdba84e5ff7eaf410ce13e3c473b7b30ed9e6539060200160405180910390a3505050565b801580610d8757506001600160a01b03821660009081526003602052604090205481115b15610da55760405163162908e360e11b815260040160405180910390fd5b6001600160a01b03821660009081526003602052604081208054839290610dcd90849061119f565b925050819055508060056000828254610de6919061119f565b909155505060405163a9059cbb60e01b81526001600160a01b038316600482015260248101829052735425890298aed601595a70ab815c96711a31bc659063a9059cbb906044016020604051808303816000875af1158015610e4c573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610e709190611209565b610396576040516312171d8360e31b815260040160405180910390fd5b600c5460ff1680610e9f575060075442105b80610eba575062093a80600754610eb691906111b8565b4210155b15610ed857604051636670965b60e11b815260040160405180910390fd5b565b828054828255906000526020600020908101928215610f15579160200282015b82811115610f15578235825591602001919060010190610efa565b50610f21929150610f25565b5090565b5b80821115610f215760008155600101610f26565b600060208284031215610f4c57600080fd5b5035919050565b60008060408385031215610f6657600080fd5b50508035926020909101359150565b8015158114610f8357600080fd5b50565b60008060408385031215610f9957600080fd5b823591506020830135610fab81610f75565b809150509250929050565b600081518084526020840193506020830160005b82811015610fe8578151865260209586019590910190600101610fca565b5093949350505050565b600081518084526020840193506020830160005b82811015610fe85781511515865260209586019590910190600101611006565b6101208082528a5190820181905260009060208c0190610140840190835b8181101561106b5783516001600160a01b0316835260209384019390920191600101611044565b5050838103602085015261107f818d610fb6565b9150508281036040840152611094818b610fb6565b905082810360608401526110a8818a610ff2565b9150508660808301528560a08301528460c08301528360e08301526110d261010083018415159052565b9a9950505050505050505050565b600080602083850312156110f357600080fd5b823567ffffffffffffffff81111561110a57600080fd5b8301601f8101851361111b57600080fd5b803567ffffffffffffffff81111561113257600080fd5b8560208260051b840101111561114757600080fd5b6020919091019590945092505050565b634e487b7160e01b600052603260045260246000fd5b634e487b7160e01b600052601160045260246000fd5b6000600160ff1b82016111985761119861116d565b5060000390565b818103818111156111b2576111b261116d565b92915050565b808201808211156111b2576111b261116d565b634e487b7160e01b600052604160045260246000fd5b80820182811260008312801582168215821617156112015761120161116d565b505092915050565b60006020828403121561121b57600080fd5b815161122681610f75565b9392505050565b60006001820161123f5761123f61116d565b5060010190565b6001600160a01b038516815260208101849052606060408201819052810182905260008360808301825b8581101561128e578235825260209283019290910190600101611270565b5097965050505050505056fea264697066735822122019b28a5ef8c5f513999e7d071fb48bf0770a2f5ae0aba4dda4194a35f6f2101d64736f6c634300081c0033", deadlineRuntime: "608060405234801561001057600080fd5b50600436106100f55760003560e01c80639711715a11610097578063c70d484f11610066578063c70d484f146101e1578063e1aa1bcc146101f4578063e7786918146101fd578063f92a53f21461021557600080fd5b80639711715a1461019657806397b7d8d7146101b3578063987757dd146101bb578063b6b55f25146101ce57600080fd5b80634e71d92d116100d35780634e71d92d1461013f5780634ec799371461014757806361603d891461015a57806389a302711461016357600080fd5b8063190da595146100fa5780632e1a7d4d1461011757806339e78fc71461012c575b600080fd5b61010462093a8081565b6040519081526020015b60405180910390f35b61012a6101253660046112f0565b61022a565b005b61012a61013a366004611309565b610258565b61012a6103d2565b61012a610155366004611339565b61047d565b610104600f5481565b61017e735425890298aed601595a70ab815c96711a31bc6581565b6040516001600160a01b03909116815260200161010e565b61019e610545565b60405161010e999897969594939291906113d9565b61012a6107b1565b61012a6101c93660046112f0565b6107e4565b61012a6101dc3660046112f0565b610a21565b61012a6101ef366004611493565b610a5e565b61010460095481565b610205610c54565b604051901515815260200161010e565b61021d610cdd565b60405161010e919061150a565b600f54421061024c57604051636670965b60e11b815260040160405180910390fd5b61025581610d9b565b50565b3360009081526002602052604090205460ff16610287576040516282b42960e81b815260040160405180910390fd5b61028f610e37565b80158061029e5750600c548114155b156102bc576040516321f2425960e01b815260040160405180910390fd5b60005b6001548110156103c457336001600160a01b0316600182815481106102e6576102e6611524565b6000918252602090912001546001600160a01b0316036103bc57600080600d838154811061031657610316611524565b90600052602060002001541261032d576000610354565b600d828154811061034057610340611524565b906000526020600020015461035490611550565b9050600081600a5411610367578161036b565b600a545b3360009081526003602052604090205490915081811015806103965750610392818361156c565b8614155b156103b45760405163162908e360e11b815260040160405180910390fd5b5050506103c4565b6001016102bf565b506103ce82610a21565b5050565b6103da610c54565b15610462573360009081526002602052604090205460ff1661040e576040516282b42960e81b815260040160405180910390fd5b33600081815260036020526040902054906104299082610e47565b60405181815233907fd8138f8a3f377c5259ca548e70e4c2de94f129f5a11036a15b69513cba2b426a906020015b60405180910390a250565b600f54421061047357610473610f71565b61047b610fa6565b565b3360009081526002602052604090205460ff166104ac576040516282b42960e81b815260040160405180910390fd5b6104b4610e37565b8115806104c35750600c548214155b156104e1576040516321f2425960e01b815260040160405180910390fd5b806104ed5760006104ef565b815b336000818152600560205260409081902092909255905183907fa84a380d7909dd30db05e5cd1fdba84e5ff7eaf410ce13e3c473b7b30ed9e6539061053990851515815260200190565b60405180910390a35050565b606080606080600080600080600060018054806020026020016040519081016040528092919081815260200182805480156105a957602002820191906000526020600020905b81546001600160a01b0316815260019091019060200180831161058b575b5050600154939c50505067ffffffffffffffff82111590506105cd576105cd611585565b6040519080825280602002602001820160405280156105f6578160200160208202803683370190505b5060015490985067ffffffffffffffff81111561061557610615611585565b60405190808252806020026020018201604052801561063e578160200160208202803683370190505b50955060005b60015481101561072057600360006001838154811061066557610665611524565b60009182526020808320909101546001600160a01b0316835282019290925260400190205489518a908390811061069e5761069e611524565b6020908102919091010152600c54158015906106f65750600c5460056000600184815481106106cf576106cf611524565b60009182526020808320909101546001600160a01b03168352820192909252604001902054145b87828151811061070857610708611524565b91151560209283029190910190910152600101610644565b508888600d88600c54600754600854600a54600e60009054906101000a900460ff168680548060200260200160405190810160405280929190818152602001828054801561078d57602002820191906000526020600020905b815481526020019060010190808311610779575b50505050509650985098509850985098509850985098509850909192939495969798565b6007544210156107d457604051636670965b60e11b815260040160405180910390fd5b6107dc610f71565b61047b611007565b6000546001600160a01b0316331461080e576040516282b42960e81b815260040160405180910390fd5b610816610e37565b8015806108255750600c548114155b15610843576040516321f2425960e01b815260040160405180910390fd5b60005b6001548110156109e55760006001828154811061086557610865611524565b60009182526020808320909101546001600160a01b0316808352600590915260409091205490915083146108bc5760405163d4e69ce760e01b81526001600160a01b03821660048201526024015b60405180910390fd5b6001600160a01b038116600090815260036020526040812054600d8054919291829190869081106108ef576108ef611524565b90600052602060002001541261090657600061092d565b600d848154811061091957610919611524565b906000526020600020015461092d90611550565b9050600081600a54116109405781610944565b600a545b9050808310156109805760405163f589588b60e01b81526001600160a01b038516600482015260248101829052604481018490526064016108b3565b6000600d868154811061099557610995611524565b9060005260206000200154846109ab919061159b565b6001600160a01b03909516600090815260036020908152604080832088905560049091529020949094555050600190920191506108469050565b50600e805460ff1916600117905560405181907fd647759a2f3297cba8e32e398356f87d2583ecaaad1741fc2d5f7d67fd86198490600090a250565b600f544210610a5557610a32610f71565b600754421015610a5557604051636670965b60e11b815260040160405180910390fd5b610255816110b1565b6000546001600160a01b03163314610a88576040516282b42960e81b815260040160405180910390fd5b610a90610e37565b6001548114610ab2576040516321f2425960e01b815260040160405180910390fd5b6000805b82811015610b5d57610ace661fffffffffffff611550565b848483818110610ae057610ae0611524565b905060200201351280610b115750661fffffffffffff848483818110610b0857610b08611524565b90506020020135135b15610b2f576040516321f2425960e01b815260040160405180910390fd5b838382818110610b4157610b41611524565b9050602002013582610b53919061159b565b9150600101610ab6565b508015610b7d576040516321f2425960e01b815260040160405180910390fd5b600b60008154610b8c906115c3565b90915550610b9c600d8484611299565b50600b54604051610bb5913091869086906020016115dc565b60408051808303601f190181528282528051602091820120600c8190553360009081526005835292909220829055600b54835290917fe7b042f807192ab71e679eb4a22e68c98199b7ab4de7e1d3c5a8f2889d6e971f910160405180910390a2600c54604051600181523391907fa84a380d7909dd30db05e5cd1fdba84e5ff7eaf410ce13e3c473b7b30ed9e6539060200160405180910390a3505050565b6000600f54421080610c68575060105460ff165b15610c735750600090565b60005b600154811015610cd557600a546003600060018481548110610c9a57610c9a611524565b60009182526020808320909101546001600160a01b031683528201929092526040019020541015610ccd57600191505090565b600101610c76565b506000905090565b60015460609067ffffffffffffffff811115610cfb57610cfb611585565b604051908082528060200260200182016040528015610d24578160200160208202803683370190505b50905060005b600154811015610d97576004600060018381548110610d4b57610d4b611524565b60009182526020808320909101546001600160a01b031683528201929092526040019020548251839083908110610d8457610d84611524565b6020908102919091010152600101610d2a565b5090565b3360009081526002602052604090205460ff16610dca576040516282b42960e81b815260040160405180910390fd5b60075442101580610ddd57506008544210155b15610dfb57604051636670965b60e11b815260040160405180910390fd5b610e053382610e47565b60405181815233907f7084f5476618d8e60b11ef0d7d3f06914655adb8793e28ff7f018d4c76d505d590602001610457565b610e3f61125c565b61047b610f71565b801580610e6b57506001600160a01b03821660009081526003602052604090205481115b15610e895760405163162908e360e11b815260040160405180910390fd5b6001600160a01b03821660009081526003602052604081208054839290610eb190849061156c565b925050819055508060066000828254610eca919061156c565b909155505060405163a9059cbb60e01b81526001600160a01b038316600482015260248101829052735425890298aed601595a70ab815c96711a31bc659063a9059cbb906044016020604051808303816000875af1158015610f30573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610f549190611630565b6103ce576040516312171d8360e31b815260040160405180910390fd5b610f79610c54565b15610f975760405163362f189f60e01b815260040160405180910390fd5b6010805460ff19166001179055565b3360009081526002602052604090205460ff16610fd5576040516282b42960e81b815260040160405180910390fd5b600e5460ff16158015610fe9575060095442105b1561040e57604051636670965b60e11b815260040160405180910390fd5b6000546001600160a01b03163314611031576040516282b42960e81b815260040160405180910390fd5b600e5460ff168061104457506008544210155b1561106257604051636670965b60e11b815260040160405180910390fd5b4260088190556110769062093a809061164d565b6009556008546040519081527f1b099693c249db2feed5e2b631cc7d36dc0fd031c2f52a58595ecd8d0c7f5a4a9060200160405180910390a1565b3360009081526002602052604090205460ff166110e0576040516282b42960e81b815260040160405180910390fd5b600e5460ff16806110f357506009544210155b1561111157604051636670965b60e11b815260040160405180910390fd5b801580611130575060065461112d90661fffffffffffff61156c565b81115b1561114e5760405163162908e360e11b815260040160405180910390fd5b336000908152600360205260408120805483929061116d90849061164d565b925050819055508060066000828254611186919061164d565b90915550506040516323b872dd60e01b815233600482015230602482015260448101829052735425890298aed601595a70ab815c96711a31bc65906323b872dd906064016020604051808303816000875af11580156111e9573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061120d9190611630565b61122a576040516312171d8360e31b815260040160405180910390fd5b60405181815233907f2da466a7b24304f47e87fa2e1e5a81b9831ce54fec19055ce277ca2f39ba42c490602001610457565b600e5460ff168061126e575060085442105b8061127b57506009544210155b1561047b57604051636670965b60e11b815260040160405180910390fd5b8280548282559060005260206000209081019282156112d4579160200282015b828111156112d45782358255916020019190600101906112b9565b50610d979291505b80821115610d9757600081556001016112dc565b60006020828403121561130257600080fd5b5035919050565b6000806040838503121561131c57600080fd5b50508035926020909101359150565b801515811461025557600080fd5b6000806040838503121561134c57600080fd5b82359150602083013561135e8161132b565b809150509250929050565b600081518084526020840193506020830160005b8281101561139b57815186526020958601959091019060010161137d565b5093949350505050565b600081518084526020840193506020830160005b8281101561139b57815115158652602095860195909101906001016113b9565b6101208082528a5190820181905260009060208c0190610140840190835b8181101561141e5783516001600160a01b03168352602093840193909201916001016113f7565b50508381036020850152611432818d611369565b9150508281036040840152611447818b611369565b9050828103606084015261145b818a6113a5565b9150508660808301528560a08301528460c08301528360e083015261148561010083018415159052565b9a9950505050505050505050565b600080602083850312156114a657600080fd5b823567ffffffffffffffff8111156114bd57600080fd5b8301601f810185136114ce57600080fd5b803567ffffffffffffffff8111156114e557600080fd5b8560208260051b84010111156114fa57600080fd5b6020919091019590945092505050565b60208152600061151d6020830184611369565b9392505050565b634e487b7160e01b600052603260045260246000fd5b634e487b7160e01b600052601160045260246000fd5b6000600160ff1b82016115655761156561153a565b5060000390565b8181038181111561157f5761157f61153a565b92915050565b634e487b7160e01b600052604160045260246000fd5b80820182811260008312801582168215821617156115bb576115bb61153a565b505092915050565b6000600182016115d5576115d561153a565b5060010190565b6001600160a01b038516815260208101849052606060408201819052810182905260008360808301825b85811015611624578235825260209283019290910190600101611606565b50979650505050505050565b60006020828403121561164257600080fd5b815161151d8161132b565b8082018082111561157f5761157f61153a56fea26469706673582212206e2b1359ae8f3319c48c4d8811cd024b6ac0645d90ca2e223ada8806c63e6b6d64736f6c634300081c0033" };
var CHAIN = 43113;
var RPC = "https://api.avax-test.network/ext/bc/C/rpc";
var MAX_MEMBERS = 12;
var FIVE_MINUTES = 300000;
var DAY = 86400000;
var REFUND_DELAY_SECONDS = 7n * 86400n;
var LOCAL_HTML = "TripVault_Rooms_v9.html";
var ZERO = /^0x0{40}$/i;
var ADDRESS = /^0x[0-9a-f]{40}$/i;
var HASH = /^0x[0-9a-f]{64}$/i;
var ROOM_ID = /^room-[a-f0-9-]{36}$/;

class RoomError extends Error {
  constructor(status, message, funding) {
    super(message);
    this.status = status;
    this.funding = funding;
  }
}
function assert2(value, status, message) {
  if (!value)
    throw new RoomError(status, message);
}
function text(value, max, label, required = true) {
  assert2(typeof value === "string", 400, `Enter a valid ${label}.`);
  const clean = value.trim();
  assert2(clean.length <= max && (!required || clean.length), 400, `Enter a valid ${label}.`);
  return clean;
}
function safeAddress(input) {
  assert2(typeof input === "string" && ADDRESS.test(input) && !ZERO.test(input), 400, "Invalid wallet address.");
  return input.toLowerCase();
}
function opaque() {
  return randomBytes2(24).toString("base64url");
}
function digest(token) {
  return createHash("sha256").update(token).digest("hex");
}
function isUnits(value) {
  return Number.isSafeInteger(value) && value > 0;
}
function makeTrip(settings, address, id) {
  const name = text(settings.name, 70, "trip name");
  const displayName = text(settings.displayName, 40, "display name", false) || shorten(address);
  const location = text(settings.location, 80, "destination", false);
  const start = settings.start;
  const end = settings.end;
  assert2(Number.isSafeInteger(start) && Number.isSafeInteger(end) && start > Date.now() && end > start && end < 253402300799000, 400, "Choose valid future trip dates.");
  const deadline = settings.deadline;
  assert2(Number.isSafeInteger(deadline) && Math.floor(deadline / 1000) > Math.floor(Date.now() / 1000) && Math.floor(deadline / 1000) < Math.floor(start / 1000) && Math.floor(start / 1000) < Math.floor(end / 1000), 400, "Choose a future deposit deadline before the trip starts.");
  assert2(isUnits(settings.minimumUnits), 400, "Enter a positive minimum deposit.");
  return {
    id,
    shared: true,
    name,
    location,
    owner: "m0",
    members: [{ id: "m0", name: displayName, address }],
    startTime: new Date(start).toISOString(),
    endTime: new Date(end).toISOString(),
    depositDeadline: new Date(deadline).toISOString(),
    minimumUnits: settings.minimumUnits,
    locked: false,
    depositUnits: {},
    bills: [],
    nextBillId: 1,
    splitApprovals: [],
    reviewQuote: null,
    revision: 1,
    version: 1,
    settled: false
  };
}
function shorten(address) {
  return address.slice(0, 6) + "\u2026" + address.slice(-4);
}
function invalidateSplit(trip) {
  trip.reviewQuote = null;
  trip.splitApprovals = [];
  trip.revision++;
}
function billStatus(bill) {
  if (bill.cancellation)
    return "cancellation";
  if (bill.feedback?.length)
    return "disputed";
  return bill.participants.every((id) => bill.approvals.includes(id)) ? "approved" : "pending";
}
function billReviewers(bill) {
  return [...new Set([bill.createdBy || bill.payer, bill.payer, ...bill.participants])];
}
function logBillNotification(bill, kind, actor, recipients, receivedAt, comment, id = randomUUID()) {
  const targets = [...new Set(recipients)].filter((member) => member !== actor);
  if (!targets.length)
    return;
  bill.notificationLog = [...bill.notificationLog || [], {
    id,
    kind,
    actor,
    recipients: targets,
    receivedAt,
    label: bill.label,
    comment
  }].slice(-50);
}
function billDetails(trip, data) {
  const label = text(data.label, 70, "bill name");
  const { amount, payer, participants, splitType, customShares } = data;
  const ids = new Set(trip.members.map((member) => member.id));
  assert2(isUnits(amount) && amount <= 1e9 && ids.has(payer) && Array.isArray(participants) && participants.length > 0 && participants.length <= ids.size && new Set(participants).size === participants.length && participants.every((id) => ids.has(id)), 400, "Enter valid bill details and choose the members sharing it.");
  if (splitType === "custom" && customShares && typeof customShares === "object") {
    let sum = 0;
    const validated = {};
    for (const pid of participants) {
      const val = Math.round(Number(customShares[pid]) || 0);
      assert2(val >= 0 && Number.isSafeInteger(val), 400, "Invalid custom share amount.");
      validated[pid] = val;
      sum += val;
    }
    assert2(sum === amount, 400, `The sum of custom shares (${sum}) must equal the total bill amount (${amount}).`);
    return { label, amount, payer, participants, splitType: "custom", customShares: validated };
  }
  return { label, amount, payer, participants, splitType: "equal" };
}
function cleanQuote(quote) {
  assert2(quote && typeof quote === "object" && Number.isFinite(quote.rate) && quote.rate >= 1 && quote.rate <= 1e9, 400, "Invalid USD/VND reference.");
  return {
    rate: quote.rate,
    live: quote.live === true,
    source: text(quote.source, 140, "rate source"),
    updated: text(quote.updated, 140, "rate timestamp")
  };
}
var iface = new Interface([
  "function snapshot() view returns (address[],uint256[],int256[],bool[],bytes32,uint256,uint256,uint256,bool)",
  "function propose(int256[])",
  "function settle(bytes32)",
  "function endTripEarly()",
  "function refundDeadline() view returns (uint256)",
  "function depositDeadline() view returns (uint256)",
  "function fundingFailed() view returns (bool)"
]);
async function vaultFundingFailed(address, block, rpc) {
  const raw = await rpc("eth_call", [{ to: address, data: iface.encodeFunctionData("fundingFailed") }, block]);
  return iface.decodeFunctionResult("fundingFailed", raw)[0];
}
async function fujiRpc(method, params) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok)
    throw new RoomError(503, "Fuji is unavailable. Check the transaction again.");
  const result = await response.json();
  if (result.error)
    throw new RoomError(503, "Fuji is unavailable. Check the transaction again.");
  return result.result;
}
async function marketFundingRate() {
  const response = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(7000) });
  if (!response.ok)
    return null;
  const quote = await response.json();
  return quote.result === "success" ? quote.rates?.VND : null;
}
async function readFujiFunding(trip, rpc) {
  const address = trip.fuji.address;
  const block = await rpc("eth_getBlockByNumber", ["latest", false]);
  assert2(block && /^0x[0-9a-f]+$/i.test(block.number) && /^0x[0-9a-f]+$/i.test(block.timestamp), 503, "Could not verify vault funding on Fuji. Try again.");
  const raw = await rpc("eth_call", [{ to: address, data: iface.encodeFunctionData("snapshot") }, block.number]);
  const [members, balances, , , , start, end, minimum, settled] = iface.decodeFunctionResult("snapshot", raw);
  assert2(members.length === trip.members.length && balances.length === members.length && members.every((member, index) => member.toLowerCase() === trip.members[index].address) && minimum === BigInt(trip.minimumUnits) && balances.every((balance) => balance <= BigInt(Number.MAX_SAFE_INTEGER)), 503, "Could not verify vault balances for this room.");
  let deadline = end + REFUND_DELAY_SECONDS;
  const now = BigInt(block.timestamp);
  if (!settled && now >= deadline && trip.fuji.contractVersion >= 2) {
    const result = await rpc("eth_call", [{ to: address, data: iface.encodeFunctionData("refundDeadline") }, block.number]);
    [deadline] = iface.decodeFunctionResult("refundDeadline", result);
  }
  const hasDeadline = trip.fuji.contractVersion === 3;
  const deadlineReached = hasDeadline && now >= BigInt(Math.floor(Date.parse(trip.depositDeadline) / 1000));
  const cancelled = deadlineReached && await vaultFundingFailed(address, block.number, rpc);
  return {
    balances: balances.map(Number),
    closed: cancelled || settled || now >= deadline,
    ...hasDeadline ? { cancelled, deadlineReached, started: now >= start, ended: now >= end } : {}
  };
}
function tripEnd(trip) {
  return Date.parse(trip.endedAt || trip.endTime);
}
async function verifyChainProof(trip, address, data, rpc) {
  assert2(typeof data.hash === "string" && HASH.test(data.hash), 400, "Invalid transaction hash.");
  assert2(["deploy", "fuji-publish", "fuji-settle", "fuji-end"].includes(data.kind), 400, "Unknown Fuji proof.");
  const [receipt, transaction] = await Promise.all([
    rpc("eth_getTransactionReceipt", [data.hash]),
    rpc("eth_getTransactionByHash", [data.hash])
  ]);
  assert2(receipt?.status === "0x1" && receipt.transactionHash?.toLowerCase() === data.hash.toLowerCase() && transaction?.hash?.toLowerCase() === data.hash.toLowerCase() && transaction.from?.toLowerCase() === address && /^0x[0-9a-f]+$/i.test(receipt.blockNumber) && /^0x[0-9a-f]+$/i.test(receipt.transactionIndex), 409, "Fuji has not confirmed this organizer transaction.");
  const proof = {
    kind: data.kind,
    block: Number(BigInt(receipt.blockNumber)),
    index: Number(BigInt(receipt.transactionIndex)),
    hash: data.hash.toLowerCase()
  };
  if (data.kind === "deploy") {
    proof.address = safeAddress(receipt.contractAddress);
    assert2(transaction.to === null && trip.locked, 409, "The room roster must be locked before deployment.");
    const [code, raw] = await Promise.all([
      rpc("eth_getCode", [proof.address, "latest"]),
      rpc("eth_call", [{ to: proof.address, data: iface.encodeFunctionData("snapshot") }, "latest"])
    ]);
    const runtime = code?.toLowerCase();
    proof.version = runtime === "0x" + CONTRACT.deadlineRuntime ? 3 : runtime === "0x" + CONTRACT.runtime ? 2 : runtime === "0x" + CONTRACT.legacyRuntime ? 1 : 0;
    assert2(proof.version, 400, "The deployed vault does not match TripVault.");
    assert2(Boolean(trip.depositDeadline) === (proof.version === 3), 409, "The vault must use this trip\u2019s deposit deadline rules.");
    const [roster, , , , , start, end, minimum] = iface.decodeFunctionResult("snapshot", raw);
    assert2(roster.length === trip.members.length && roster.every((member, index) => member.toLowerCase() === trip.members[index].address) && start === BigInt(Math.floor(Date.parse(trip.startTime) / 1000)) && end === BigInt(Math.floor(tripEnd(trip) / 1000)) && minimum === BigInt(trip.minimumUnits), 409, "The deployed vault has different room settings or members.");
    if (proof.version === 3) {
      const rawDeadline = await rpc("eth_call", [{ to: proof.address, data: iface.encodeFunctionData("depositDeadline") }, "latest"]);
      const [deadline] = iface.decodeFunctionResult("depositDeadline", rawDeadline);
      assert2(deadline === BigInt(Math.floor(Date.parse(trip.depositDeadline) / 1000)), 409, "This vault has a different deposit deadline.");
    }
  } else {
    assert2(trip.fuji?.address && transaction.to?.toLowerCase() === trip.fuji.address, 400, "This transaction belongs to a different vault.");
    const expected = { "fuji-publish": "propose", "fuji-settle": "settle", "fuji-end": "endTripEarly" }[data.kind];
    assert2(transaction.input?.startsWith(iface.getFunction(expected).selector), 400, "This transaction does not match the requested action.");
    if (data.kind === "fuji-publish") {
      assert2(Number.isSafeInteger(data.revision) && data.revision > 0 && data.revision <= trip.revision, 400, "Invalid split revision.");
      proof.revision = String(data.revision);
    }
    if (data.kind === "fuji-end") {
      assert2(trip.fuji.contractVersion >= 2, 409, "This vault uses the original end time.");
      const raw = await rpc("eth_call", [{ to: trip.fuji.address, data: iface.encodeFunctionData("snapshot") }, receipt.blockNumber]);
      const [, , , , , , end] = iface.decodeFunctionResult("snapshot", raw);
      const timestamp = Number(end) * 1000;
      assert2(Number.isSafeInteger(timestamp) && timestamp <= tripEnd(trip) && timestamp > 0, 409, "The new trip end time could not be verified.");
      proof.endedAt = new Date(timestamp).toISOString();
    }
  }
  return proof;
}
async function checkVaultCanBeDeleted(address, contractVersion, rpc) {
  const block = await rpc("eth_getBlockByNumber", ["latest", false]);
  assert2(block && /^0x[0-9a-f]+$/i.test(block.number) && /^0x[0-9a-f]+$/i.test(block.timestamp), 503, "Fuji is unavailable. Try checking the vault again.");
  const raw = await rpc("eth_call", [{ to: address, data: iface.encodeFunctionData("snapshot") }, block.number]);
  const [members, balances, , , , , end, , settled] = iface.decodeFunctionResult("snapshot", raw);
  assert2(members.length > 0 && members.length === balances.length, 503, "Fuji vault balances could not be verified.");
  const cancelled = contractVersion === 3 && await vaultFundingFailed(address, block.number, rpc);
  if (!settled && !cancelled) {
    let deadline = end + REFUND_DELAY_SECONDS;
    if (contractVersion >= 2) {
      const rawDeadline = await rpc("eth_call", [{ to: address, data: iface.encodeFunctionData("refundDeadline") }, block.number]);
      [deadline] = iface.decodeFunctionResult("refundDeadline", rawDeadline);
    }
    assert2(BigInt(block.timestamp) >= deadline, 409, "The Fuji vault is still open. Settle the trip or wait until the refund window opens.");
  }
  assert2(balances.every((balance) => balance === 0n), 409, "Members must claim their remaining Fuji balances before this trip can be deleted.");
}
function isAllowedOrigin(from, origin) {
  if (!from || from === origin)
    return true;
  try {
    const fromUrl = new URL(from);
    const originUrl = new URL(origin);
    const isLocalFrom = fromUrl.hostname === "127.0.0.1" || fromUrl.hostname === "localhost";
    const isLocalOrigin = originUrl.hostname === "127.0.0.1" || originUrl.hostname === "localhost";
    return isLocalFrom && isLocalOrigin && fromUrl.port === originUrl.port;
  } catch {
    return false;
  }
}
function createRoomApi({ database, origin, rpc = fujiRpc, fetchFundingRate = marketFundingRate, now = Date.now }) {
  const db = database;
  const domain = new URL(origin).host;
  const signInHeader = `${domain} wants you to sign in with your Ethereum account:`;
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS auth_challenges (
      nonce TEXT PRIMARY KEY, address TEXT NOT NULL, message TEXT NOT NULL, expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY, address TEXT NOT NULL, expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, invite TEXT UNIQUE NOT NULL,
      snapshot TEXT NOT NULL, created INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS rooms_unique_vault
      ON rooms(json_extract(snapshot, '$.fuji.address'))
      WHERE json_extract(snapshot, '$.fuji.address') IS NOT NULL;
    CREATE TABLE IF NOT EXISTS room_members (
      room_id TEXT NOT NULL REFERENCES rooms(id), address TEXT NOT NULL,
      PRIMARY KEY(room_id, address)
    );
    CREATE TABLE IF NOT EXISTS top_up_reminders (
      id TEXT NOT NULL UNIQUE,
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      sender TEXT NOT NULL,
      draft TEXT NOT NULL,
      recipients TEXT NOT NULL,
      updated INTEGER NOT NULL,
      PRIMARY KEY(room_id, sender)
    );
  `);
  const insertChallenge = db.query("INSERT INTO auth_challenges VALUES (?, ?, ?, ?)");
  const getChallenge = db.query("SELECT * FROM auth_challenges WHERE nonce = ? AND expires > ?");
  const deleteChallenge = db.query("DELETE FROM auth_challenges WHERE nonce = ?");
  const insertSession = db.query("INSERT INTO auth_sessions VALUES (?, ?, ?)");
  const getSession = db.query("SELECT address FROM auth_sessions WHERE token_hash = ? AND expires > ?");
  const getRoom = db.query("SELECT * FROM rooms WHERE id = ?");
  const getInvite = db.query("SELECT * FROM rooms WHERE invite = ?");
  const getCode = db.query("SELECT * FROM rooms WHERE code = ?");
  const insertRoom = db.query("INSERT INTO rooms VALUES (?, ?, ?, ?, ?)");
  const updateRoom = db.query("UPDATE rooms SET snapshot = ? WHERE id = ?");
  const insertMember = db.query("INSERT INTO room_members VALUES (?, ?)");
  const deleteMembers = db.query("DELETE FROM room_members WHERE room_id = ?");
  const deleteRoom = db.query("DELETE FROM rooms WHERE id = ?");
  const getRooms = db.query(`SELECT rooms.* FROM rooms
    JOIN room_members ON rooms.id = room_members.room_id
    WHERE room_members.address = ? ORDER BY rooms.created DESC`);
  const getReminders = db.query(`SELECT reminder.id, reminder.room_id, reminder.sender, reminder.draft, reminder.updated,
      recipient.value AS recipient, rooms.snapshot
    FROM top_up_reminders AS reminder
    JOIN rooms ON rooms.id = reminder.room_id
    JOIN room_members AS member ON member.room_id = reminder.room_id
    JOIN json_each(reminder.recipients) AS recipient
    WHERE member.address = ?1 AND json_extract(recipient.value, '$.address') = ?1
      AND json_extract(rooms.snapshot, '$.settled') = 0
    ORDER BY reminder.updated DESC`);
  const saveReminder = db.query(`INSERT INTO top_up_reminders VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(room_id, sender) DO UPDATE SET
      id = excluded.id, draft = excluded.draft, recipients = excluded.recipients, updated = excluded.updated`);
  const clearBillReminder = db.query("DELETE FROM top_up_reminders WHERE room_id = ? AND draft = ?");
  const clearRoomReminders = db.query("DELETE FROM top_up_reminders WHERE room_id = ?");
  const limitBuckets = new Map;
  let fundingRate = null;
  let fundingRateExpires = 0;
  let fundingRateRequest;
  function getFundingRate() {
    if (Date.now() < fundingRateExpires)
      return fundingRate;
    fundingRateRequest ??= Promise.resolve().then(fetchFundingRate).then((rate) => {
      fundingRate = Number.isFinite(rate) && rate >= 1 && rate <= 1e9 ? rate : null;
      fundingRateExpires = Date.now() + (fundingRate ? FIVE_MINUTES : 5000);
      return fundingRate;
    }, () => {
      fundingRate = null;
      fundingRateExpires = Date.now() + 5000;
      return null;
    }).finally(() => {
      fundingRateRequest = null;
    });
    return fundingRateRequest;
  }
  async function getRoomFunding(trip) {
    assert2(trip.fuji?.address, 409, "The organizer needs to link the Fuji vault before anyone can add bills.");
    const [snapshot, rate] = await Promise.all([readFujiFunding(trip, rpc), getFundingRate()]);
    return { ...snapshot, rate, version: trip.version };
  }
  function throttle(scope, key, max) {
    const now = Date.now();
    if (limitBuckets.size > 2048) {
      for (const [id, bucket] of limitBuckets)
        if (bucket.until <= now)
          limitBuckets.delete(id);
      assert2(limitBuckets.size < 4096, 429, "Too many attempts. Try again in a few minutes.");
    }
    const id = scope + ":" + key;
    const previous = limitBuckets.get(id);
    const bucket = previous?.until > now ? previous : { count: 0, until: now + FIVE_MINUTES };
    bucket.count++;
    limitBuckets.set(id, bucket);
    assert2(bucket.count <= max, 429, "Too many attempts. Try again in a few minutes.");
  }
  function authenticate(request) {
    const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{32})$/)?.[1];
    const session = token && getSession.get(digest(token), Date.now());
    assert2(session, 401, "Connect and sign in with your wallet again.");
    return session.address;
  }
  function presentation(record, address) {
    const trip = JSON.parse(record.snapshot);
    const self = trip.members.find((member) => member.address === address);
    assert2(self, 404, "Room unavailable.");
    for (const bill of trip.bills) {
      if (bill.feedbackLog) {
        bill.feedbackLog = bill.feedbackLog.filter((item) => item.recipients.includes(self.id));
      }
      if (bill.notificationLog) {
        bill.notificationLog = bill.notificationLog.filter((item) => item.recipients.includes(self.id));
      }
    }
    return self.id === trip.owner ? { ...trip, code: record.code, invite: record.invite } : trip;
  }
  function readMemberRoom(id, address) {
    const record = getRoom.get(id);
    assert2(record, 404, "Room unavailable.");
    const trip = JSON.parse(record.snapshot);
    const self = trip.members.find((member) => member.address === address);
    assert2(self, 404, "Room unavailable.");
    return { record, trip, self };
  }
  function persist(record, trip, address) {
    trip.version++;
    const snapshot = JSON.stringify(trip);
    updateRoom.run(snapshot, record.id);
    return presentation({ ...record, snapshot }, address);
  }
  function closeTripBills(trip) {
    if (trip.billsClosedAt || tripEnd(trip) > now())
      return false;
    trip.billsClosedAt = new Date(tripEnd(trip)).toISOString();
    clearRoomReminders.run(trip.id);
    return true;
  }
  function refreshBillReviews(trip, time) {
    let changed = false;
    let autoApproved = false;
    for (const bill of trip.bills) {
      if (bill.status !== "pending")
        continue;
      if (!bill.reviewBy) {
        bill.createdBy = bill.payer;
        bill.approvals = bill.approvals.filter((id) => bill.participants.includes(id));
        bill.reviewBy = time + DAY;
        bill.status = billStatus(bill);
        changed = true;
        if (bill.status === "approved") {
          autoApproved = true;
          continue;
        }
      }
      if (!trip.reviewQuote && !trip.settled && bill.reviewBy <= time) {
        bill.autoApprovals = bill.participants.filter((id) => !bill.approvals.includes(id));
        bill.status = "approved";
        autoApproved = true;
      }
    }
    if (autoApproved)
      invalidateSplit(trip);
    return changed || autoApproved;
  }
  const refreshBills = db.transaction((records) => {
    for (const record of records) {
      const latest = getRoom.get(record.id);
      if (!latest)
        continue;
      const trip = JSON.parse(latest.snapshot);
      const closed = closeTripBills(trip);
      if (refreshBillReviews(trip, now()) || closed) {
        trip.version++;
        updateRoom.run(JSON.stringify(trip), trip.id);
      }
    }
  });
  function refreshDueBills(records) {
    const time = now();
    const due = records.filter((record) => {
      const trip = JSON.parse(record.snapshot);
      return !trip.billsClosedAt && tripEnd(trip) <= time || trip.bills.some((bill) => bill.status === "pending" && (!bill.reviewBy || bill.reviewBy <= time));
    });
    if (due.length)
      refreshBills.immediate(due);
    return due.length > 0;
  }
  function remindersFor(address) {
    return getReminders.all(address).map((row) => {
      const trip = JSON.parse(row.snapshot);
      return {
        id: row.id,
        roomId: row.room_id,
        tripName: trip.name,
        draft: JSON.parse(row.draft),
        sender: trip.members.find((member) => member.address === row.sender)?.name,
        units: JSON.parse(row.recipient).units,
        receivedAt: row.updated
      };
    });
  }
  const sendTopUpReminder = db.transaction((id, address, version, draft, funding) => {
    const { trip, self } = readMemberRoom(id, address);
    assert2(trip.version === version, 409, "The trip changed. Check the amounts and try again.");
    assert2(tripEnd(trip) > now(), 409, "The trip has ended. New bills are closed.");
    assert2(!trip.settled && !funding.closed && funding.started !== false, 409, "Bills are not open for this trip.");
    assert2(funding.rate, 503, "Could not check the exchange rate. Try again.");
    const recipients = roomFundingShortfalls(trip, funding, draft).filter((item) => item.id !== self.id).map((item) => ({ address: trip.members.find((member) => member.id === item.id).address, units: item.units }));
    assert2(recipients.length, 409, "Everyone else has already added enough for this bill.");
    saveReminder.run(randomUUID(), id, address, JSON.stringify(draft), JSON.stringify(recipients), Date.now());
    return { sent: recipients.length };
  });
  const createRoom = db.transaction((address, settings) => {
    let code;
    do {
      code = String(randomInt(1e6)).padStart(6, "0");
    } while (getCode.get(code));
    const id = "room-" + randomUUID();
    const invite = opaque();
    const snapshot = JSON.stringify(makeTrip(settings, address, id));
    insertRoom.run(id, code, invite, snapshot, Date.now());
    insertMember.run(id, address);
    return presentation({ id, code, invite, snapshot }, address);
  });
  const joinRoom = db.transaction((address, data) => {
    const key = text(data.key, 32, "room code or link");
    const byCode = /^\d{6}$/.test(key);
    assert2(byCode || /^[A-Za-z0-9_-]{32}$/.test(key), 400, "Enter a six-digit room code or a valid invite link.");
    const record = byCode ? getCode.get(key) : getInvite.get(key);
    assert2(record, 404, "Room unavailable or invitations have closed.");
    const trip = JSON.parse(record.snapshot);
    if (trip.members.some((member) => member.address === address))
      return presentation(record, address);
    const inviteDeadline = trip.depositDeadline ? Date.parse(trip.depositDeadline) : tripEnd(trip);
    assert2(!trip.locked && !trip.settled && inviteDeadline > Date.now(), 404, "Room unavailable or invitations have closed.");
    assert2(trip.members.length < MAX_MEMBERS, 409, "This room has reached 12 members.");
    const name = text(data.displayName, 40, "display name", false) || shorten(address);
    const id = "m" + trip.members.length;
    trip.members.push({ id, name, address, joinedAt: Date.now() });
    insertMember.run(record.id, address);
    invalidateSplit(trip);
    return persist(record, trip, address);
  });
  const signIn = db.transaction((data) => {
    const nonce = text(data.nonce, 48, "sign-in nonce");
    const challenge = getChallenge.get(nonce, Date.now());
    assert2(challenge?.message.includes(` wants you to sign in with your Ethereum account:
`), 401, "Wallet sign-in expired. Try again.");
    assert2(typeof data.signature === "string" && /^0x[0-9a-f]{130}$/i.test(data.signature), 401, "Invalid wallet signature.");
    let signer;
    try {
      signer = verifyMessage(challenge.message, data.signature).toLowerCase();
    } catch {}
    assert2(signer === challenge.address, 401, "The selected wallet did not sign this request.");
    deleteChallenge.run(nonce);
    const token = opaque();
    insertSession.run(digest(token), signer, Date.now() + DAY);
    return { token, address: signer };
  });
  const mutate = db.transaction((id, address, data, funding) => {
    const { record, trip, self } = readMemberRoom(id, address);
    const organizer = self.id === trip.owner;
    if (data.type === "room.freeze") {
      assert2(organizer, 403, "Only the organizer can lock the roster.");
      if (trip.locked)
        return presentation(record, address);
      assert2(!trip.depositDeadline || Date.parse(trip.depositDeadline) > Date.now(), 409, "The deposit deadline has passed.");
      trip.locked = true;
      trip.rosterLockedAt = now();
      return persist(record, trip, address);
    }
    assert2(!trip.settled || data.type === "room.rename-member", 409, "The room has already settled on Fuji.");
    assert2(data.version === trip.version, 409, "The room changed. Refresh and try again.");
    switch (data.type) {
      case "room.rename": {
        assert2(organizer, 403, "Only the organizer can rename the trip.");
        assert2(now() < Math.min(Date.parse(trip.depositDeadline || trip.startTime), tripEnd(trip)), 409, "The trip name can only be changed before the deposit deadline.");
        trip.name = text(data.name, 70, "name");
        break;
      }
      case "room.rename-member": {
        const name = text(data.name, 40, "name");
        if (self.name === name)
          return presentation(record, address);
        self.name = name;
        break;
      }
      case "room.end": {
        assert2(organizer, 403, "Only the organizer can end this trip.");
        assert2(!trip.fuji?.address, 409, "End this trip from its Fuji vault.");
        assert2(!trip.depositDeadline, 409, "Trips with a deposit deadline need a funded vault before they can end early.");
        if (tripEnd(trip) <= now())
          return presentation(record, address);
        trip.endedAt = new Date(Math.floor(now() / 1000) * 1000).toISOString();
        if (!trip.locked)
          trip.rosterLockedAt = now();
        trip.locked = true;
        closeTripBills(trip);
        break;
      }
      case "bill.add":
      case "bill.edit": {
        const editing = data.type === "bill.edit";
        const previous = editing && trip.bills.find((item) => item.id === data.id);
        if (editing) {
          assert2(previous && (previous.createdBy || previous.payer) === self.id, 403, "Only the bill creator can edit it.");
          assert2(["pending", "disputed"].includes(previous.status) && !trip.reviewQuote, 409, "This bill cannot be edited now.");
          assert2(previous.status !== "pending" || previous.reviewBy > now(), 409, "The bill review time has ended. Refresh the trip.");
        } else {
          assert2(tripEnd(trip) > now(), 409, "The trip has ended. New bills are closed.");
        }
        const draft = billDetails(trip, data);
        assert2(editing || trip.bills.length < 1000, 409, "This room has reached 1,000 bills.");
        assert2(funding?.version === trip.version && !funding.closed, 409, "The Fuji vault is closed to new bills.");
        assert2(funding.started !== false, 409, "Bills open at the scheduled trip start.");
        if (!funding.rate)
          throw new RoomError(503, "The USD/VND rate is unavailable. Try again to check funding.", funding);
        const reviewStartedAt = now();
        const bill = {
          ...draft,
          id: previous?.id ?? trip.nextBillId,
          createdBy: self.id,
          approvals: [],
          status: "pending",
          reviewStartedAt,
          reviewBy: reviewStartedAt + DAY,
          ...previous?.feedbackLog ? { feedbackLog: previous.feedbackLog } : {},
          ...previous?.notificationLog ? { notificationLog: previous.notificationLog } : {},
          history: previous ? [...previous.history || [], {
            ...billDetails(trip, previous),
            reviewBy: previous.reviewBy,
            feedback: previous.feedback || []
          }].slice(-25) : []
        };
        const otherBills = editing ? trip.bills.filter((item) => item.id !== bill.id) : trip.bills;
        const shortfalls = roomFundingShortfalls({ ...trip, bills: otherBills }, funding, bill);
        if (shortfalls.length) {
          const amounts = shortfalls.map(({ id, units }) => trip.members.find((member) => member.id === id).name + " needs " + (units / 1e6).toFixed(6) + " USDC");
          throw new RoomError(409, "Top up before saving this bill. " + amounts.join(" \xB7 "), funding);
        }
        if (editing)
          trip.bills[trip.bills.indexOf(previous)] = bill;
        else {
          trip.nextBillId++;
          trip.bills.push(bill);
        }
        clearBillReminder.run(id, JSON.stringify(draft));
        invalidateSplit(trip);
        break;
      }
      case "bill.feedback-vote": {
        const bill = trip.bills.find((item) => item.id === data.id);
        assert2(bill && bill.status === "disputed" && !trip.reviewQuote, 409, "This suggestion is closed for review.");
        assert2(billReviewers(bill).includes(self.id), 403, "Only people involved in the bill can respond to suggestions.");
        assert2(typeof data.agree === "boolean", 400, "Choose whether you agree with the suggestion.");
        const suggestion = bill.feedback?.find((item) => item.author === data.author && (item.id || "") === data.suggestion);
        assert2(suggestion, 409, "This suggestion changed. Open the bill again.");
        assert2(suggestion.author !== self.id, 403, "Someone else must respond to your suggestion.");
        const responses = suggestion.responses || [];
        if (responses.find((item) => item.member === self.id)?.agree === data.agree)
          return presentation(record, address);
        suggestion.responses = [...responses.filter((item) => item.member !== self.id), { member: self.id, agree: data.agree }];
        logBillNotification(bill, data.agree ? "suggestion-agreed" : "suggestion-disagreed", self.id, [suggestion.author, bill.createdBy || bill.payer], now(), suggestion.comment);
        break;
      }
      case "bill.approve":
      case "bill.feedback":
      case "bill.cancel": {
        const bill = trip.bills.find((item) => item.id === data.id);
        assert2(bill && bill.status !== "rejected" && !trip.reviewQuote, 409, "This bill is closed for review.");
        assert2(bill.status !== "pending" || bill.reviewBy > now(), 409, "The bill review time has ended. Refresh the trip.");
        if (data.type === "bill.cancel") {
          const voters = billReviewers(bill);
          assert2(voters.includes(self.id), 403, "Only the bill creator, payer and listed people can agree to remove it.");
          assert2(typeof data.agree === "boolean", 400, "Choose whether to agree to remove this bill.");
          const existing = bill.cancellation;
          assert2(data.agree || existing, 409, "There is no request to remove this bill.");
          if (!data.agree) {
            logBillNotification(bill, "cancellation-declined", self.id, [existing.requestedBy || existing.votes[0], ...voters].filter(Boolean), now(), existing.reason);
            delete bill.cancellation;
            bill.status = existing.previous;
            if (bill.status === "pending")
              bill.reviewBy = now() + DAY;
          } else {
            assert2(!existing || data.reason === undefined, 409, "A cancellation request already exists. Read the reason before voting.");
            const cancellation = existing || {
              id: randomUUID(),
              previous: bill.status,
              votes: [],
              requestedBy: self.id,
              reason: text(data.reason, 500, "reason for cancellation"),
              requestedAt: now()
            };
            if (cancellation.votes.includes(self.id))
              return presentation(record, address);
            cancellation.votes.push(self.id);
            bill.cancellation = cancellation;
            bill.status = voters.every((id) => cancellation.votes.includes(id)) ? "rejected" : "cancellation";
            if (!existing && bill.status === "cancellation") {
              logBillNotification(bill, "cancellation-requested", self.id, trip.members.map((member) => member.id), cancellation.requestedAt, cancellation.reason, cancellation.id);
            }
            if (bill.status === "rejected")
              cancellation.resolvedAt = now();
          }
        } else {
          assert2(bill.participants.includes(self.id), 403, "Only people listed on the bill can review it.");
          assert2(bill.status === "pending" || bill.status === "disputed", 409, "This bill is closed for review.");
          if (data.type === "bill.feedback") {
            const comment = text(data.comment, 500, "reason or suggested change");
            const active = bill.feedback || [];
            const requestId = data.requestId;
            assert2(requestId === undefined || typeof requestId === "string" && /^[a-f0-9-]{36}$/i.test(requestId), 400, "The suggestion could not be sent. Open the form again.");
            const alreadySaved = (bill.feedbackLog || []).some((item) => item.author === self.id && (requestId ? item.requestId === requestId : item.comment === comment && active.some((entry) => entry.id === item.id)));
            if (alreadySaved) {
              return presentation(record, address);
            }
            const feedback = { id: randomUUID(), author: self.id, comment, receivedAt: now() };
            const recipients = billReviewers(bill).filter((member) => member !== self.id);
            bill.feedback = [...active.filter((item) => item.author !== self.id), feedback];
            bill.feedbackLog = [...bill.feedbackLog || [], {
              ...feedback,
              requestId,
              label: bill.label,
              recipients
            }].slice(-25);
            bill.approvals = bill.approvals.filter((id) => id !== self.id);
          } else {
            assert2(data.approve === true, 400, "Choose to approve the current bill.");
            if (bill.approvals.includes(self.id) && !bill.feedback?.some((item) => item.author === self.id)) {
              return presentation(record, address);
            }
            bill.feedback = (bill.feedback || []).filter((item) => item.author !== self.id);
            bill.approvals = [...new Set([...bill.approvals, self.id])];
          }
          const wasDisputed = bill.status === "disputed";
          bill.status = billStatus(bill);
          if (wasDisputed && bill.status === "pending")
            bill.reviewBy = now() + DAY;
        }
        invalidateSplit(trip);
        break;
      }
      case "split.lock":
        assert2(organizer, 403, "Only the organizer can prepare the split.");
        assert2(!trip.depositDeadline || funding?.started && !funding.closed, 409, "Final amounts can only be prepared for a funded trip.");
        assert2(tripEnd(trip) <= now(), 409, "Final amounts can be prepared when the trip ends.");
        assert2(!trip.reviewQuote && trip.bills.every((bill) => ["approved", "rejected"].includes(bill.status)), 409, "Resolve open bill reviews before preparing final amounts.");
        trip.reviewQuote = cleanQuote(data.quote);
        break;
      case "split.reopen":
        assert2(organizer, 403, "Only the organizer can reopen the split.");
        if (!trip.reviewQuote)
          return presentation(record, address);
        invalidateSplit(trip);
        break;
      default:
        throw new RoomError(400, "Unknown room action.");
    }
    return persist(record, trip, address);
  });
  function roomToDelete(id, address, version) {
    const { trip, self } = readMemberRoom(id, address);
    assert2(self.id === trip.owner, 403, "Only the organizer can delete this trip.");
    assert2(trip.version === version, 409, "The room changed. Review it before trying again.");
    return trip;
  }
  const removeRooms = db.transaction((entries, address) => {
    for (const entry of entries) {
      const trip = roomToDelete(entry.id, address, entry.version);
      assert2((trip.fuji?.address || null) === entry.vault, 409, "A Fuji vault changed. Review the selected trips and try again.");
    }
    for (const { id } of entries) {
      deleteMembers.run(id);
      deleteRoom.run(id);
    }
    return entries.map((entry) => entry.id);
  });
  async function deleteTrips(entries, address, includeName) {
    const checked = entries.map(({ id, version }) => {
      const trip = roomToDelete(id, address, version);
      return { id, version, name: trip.name, vault: trip.fuji?.address || null, contractVersion: trip.fuji?.contractVersion };
    });
    const linked = checked.filter((entry) => entry.vault);
    if (linked.length)
      throttle("delete-vault", address, 30);
    for (let index = 0;index < linked.length; index += 4) {
      await Promise.all(linked.slice(index, index + 4).map(async (entry) => {
        try {
          await checkVaultCanBeDeleted(entry.vault, entry.contractVersion, rpc);
        } catch (error) {
          if (includeName && error instanceof RoomError) {
            throw new RoomError(error.status, entry.name + " \u2014 " + error.message);
          }
          throw error;
        }
      }));
    }
    return removeRooms.immediate(checked, address);
  }
  const saveProof = db.transaction((id, address, proof) => {
    const { record, trip, self } = readMemberRoom(id, address);
    assert2(self.id === trip.owner, 403, "Only the organizer can verify a Fuji transaction for this room.");
    if (proof.kind === "deploy") {
      const previousRoom = db.query("SELECT id FROM rooms WHERE json_extract(snapshot, '$.fuji.address') = ?").get(proof.address);
      assert2(!previousRoom || previousRoom.id === id, 409, "This vault is already linked to another room.");
      assert2(!trip.fuji?.address || trip.fuji.address === proof.address, 409, "This room already has a different vault.");
      if (trip.fuji?.address === proof.address)
        return presentation(record, address);
      trip.fuji = { address: proof.address, contractVersion: proof.version, linkedAt: now() };
    } else if (proof.kind === "fuji-end") {
      if (trip.endedAt === proof.endedAt)
        return presentation(record, address);
      trip.endedAt = proof.endedAt;
      closeTripBills(trip);
    } else if (proof.kind === "fuji-settle") {
      if (trip.settled && trip.fuji.settlementTx)
        return presentation(record, address);
      trip.settled = true;
      trip.fuji.settlementTx = proof.hash;
      trip.fuji.settledAt = now();
    } else {
      const last = trip.fuji.publishedPosition;
      if (trip.settled || last && (last.block > proof.block || last.block === proof.block && last.index >= proof.index)) {
        return presentation(record, address);
      }
      trip.fuji.publishedRevision = proof.revision;
      trip.fuji.publishedAt = now();
      trip.fuji.publishedPosition = { block: proof.block, index: proof.index };
    }
    return persist(record, trip, address);
  });
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
  const json = (data, status = 200) => Response.json(data, { status, headers });
  async function readJson(request) {
    assert2(/^application\/json(?:;|$)/i.test(request.headers.get("content-type") || ""), 415, "Expected a JSON request.");
    assert2(Number(request.headers.get("content-length") || 0) <= 16384, 413, "Request too large.");
    try {
      const body = await request.text();
      assert2(body.length <= 16384, 413, "Request too large.");
      const data = JSON.parse(body);
      assert2(data && typeof data === "object" && !Array.isArray(data), 400, "Invalid request.");
      return data;
    } catch (error) {
      if (error instanceof RoomError)
        throw error;
      throw new RoomError(400, "Invalid JSON.");
    }
  }
  return async function handle(request, ip = "local") {
    try {
      const path = new URL(request.url).pathname;
      const method = request.method;
      if (method === "GET" && path === "/api/health")
        return json({ app: "tripvault-rooms", rooms: true, chainId: CHAIN, deleteTrip: true, endTrip: true, bulkDelete: true, billFunding: true, topUpReminders: true, depositDeadline: true, billReview: true, billCancellationReason: true, notificationTimestamps: true, suggestionResponses: true });
      if (method === "POST") {
        const from = request.headers.get("origin");
        assert2(isAllowedOrigin(from, origin), 403, "Open TripVault at its configured web address.");
      }
      if (method === "POST" && path === "/api/auth/challenge") {
        throttle("challenge", ip, 90);
        const from = request.headers.get("origin");
        const reqOrigin = from && isAllowedOrigin(from, origin) ? from : origin;
        const reqDomain = new URL(reqOrigin).host;
        const reqHeader = `${reqDomain} wants you to sign in with your Ethereum account:`;
        const data = await readJson(request);
        const address = safeAddress(data.address);
        const nonce = randomBytes2(16).toString("hex");
        const now = Date.now();
        const expires = now + FIVE_MINUTES;
        db.query("DELETE FROM auth_challenges WHERE expires <= ?").run(now);
        db.query("DELETE FROM auth_sessions WHERE expires <= ?").run(now);
        const message = `${reqHeader}
${getAddress(address)}

Sign in to TripVault rooms. This signature does not send a transaction.

URI: ${reqOrigin}
Version: 1
Chain ID: ${CHAIN}
Nonce: ${nonce}
Issued At: ${new Date(now).toISOString()}
Expiration Time: ${new Date(expires).toISOString()}`;
        insertChallenge.run(nonce, address, message, expires);
        return json({ nonce, message });
      }
      if (method === "POST" && path === "/api/auth/verify") {
        throttle("verify", ip, 90);
        return json(signIn.immediate(await readJson(request)));
      }
      const address = authenticate(request);
      if (method === "GET" && path === "/api/wallet/fuji-nonce") {
        throttle("wallet-nonce", address, 60);
        const reads = await Promise.allSettled(["latest", "pending"].map((tag) => rpc("eth_getTransactionCount", [address, tag])));
        let nonce = null;
        for (const read of reads) {
          if (read.status !== "fulfilled" || typeof read.value !== "string" || !/^0x[0-9a-f]{1,16}$/i.test(read.value))
            continue;
          const count = BigInt(read.value);
          if (nonce === null || count > nonce)
            nonce = count;
        }
        assert2(nonce !== null, 503, "Fuji transaction number is unavailable.");
        return json({ nonce: "0x" + nonce.toString(16) });
      }
      if (method === "POST" && path === "/api/rooms/bulk-delete") {
        const { trips } = await readJson(request);
        assert2(Array.isArray(trips) && trips.length > 0 && trips.every((trip) => typeof trip?.id === "string" && ROOM_ID.test(trip.id) && Number.isSafeInteger(trip.version) && trip.version > 0) && new Set(trips.map((trip) => trip.id)).size === trips.length, 400, "Select valid, distinct trips.");
        return json({ deleted: await deleteTrips(trips, address, true) });
      }
      if (method === "GET" && path === "/api/rooms") {
        const records = getRooms.all(address);
        const updated = refreshDueBills(records) ? getRooms.all(address) : records;
        return json({ rooms: updated.map((record) => presentation(record, address)), reminders: remindersFor(address) });
      }
      if (method === "POST" && path === "/api/rooms") {
        throttle("create", address, 20);
        return json(createRoom.immediate(address, await readJson(request)), 201);
      }
      if (method === "POST" && path === "/api/rooms/join") {
        throttle("join-ip", ip, 50);
        throttle("join-wallet", address, 20);
        return json(joinRoom.immediate(address, await readJson(request)));
      }
      const match = /^\/api\/rooms\/(room-[a-f0-9-]{36})(?:\/(actions|chain-proof|funding|top-up-reminder))?$/.exec(path);
      assert2(match, 404, "Page unavailable.");
      const [, id, action] = match;
      const { record } = readMemberRoom(id, address);
      refreshDueBills([record]);
      if (method === "GET" && !action)
        return json(presentation(readMemberRoom(id, address).record, address));
      if (method === "GET" && action === "funding") {
        const { trip } = readMemberRoom(id, address);
        return json(await getRoomFunding(trip));
      }
      if (method === "POST" && action === "top-up-reminder") {
        throttle("top-up-reminder", address, 20);
        const data = await readJson(request);
        const { trip } = readMemberRoom(id, address);
        assert2(trip.version === data.version && !trip.settled, 409, "The trip changed. Check the amounts and try again.");
        const draft = billDetails(trip, data);
        return json(sendTopUpReminder.immediate(id, address, trip.version, draft, await getRoomFunding(trip)));
      }
      if (method === "POST" && action === "actions") {
        const data = await readJson(request);
        if (["bill.add", "bill.edit", "split.lock"].includes(data.type)) {
          const { trip } = readMemberRoom(id, address);
          if (data.type === "bill.add")
            assert2(tripEnd(trip) > now(), 409, "The trip has ended. New bills are closed.");
          if (data.type === "split.lock" && !trip.depositDeadline)
            return json(mutate.immediate(id, address, data));
          assert2(!trip.settled, 409, "The room has already settled on Fuji.");
          assert2(data.version === trip.version, 409, "The room changed. Refresh and try again.");
          return json(mutate.immediate(id, address, data, await getRoomFunding(trip)));
        }
        if (data.type !== "room.delete")
          return json(mutate.immediate(id, address, data));
        await deleteTrips([{ id, version: data.version }], address, false);
        return json({ id, deleted: true });
      }
      if (method === "POST" && action === "chain-proof") {
        throttle("proof", address, 60);
        const { trip, self } = readMemberRoom(id, address);
        assert2(self.id === trip.owner, 403, "Only the organizer can verify a Fuji transaction for this room.");
        const proof = await verifyChainProof(trip, address, await readJson(request), rpc);
        return json(saveProof.immediate(id, address, proof));
      }
      return json({ error: "Page unavailable." }, 404);
    } catch (error) {
      if (error instanceof RoomError)
        return json({ error: error.message, funding: error.funding }, error.status);
      console.error("TripVault request failed:", error.message);
      return json({ error: "TripVault could not complete that request. Try again." }, 503);
    }
  };
}
if (import.meta.main) {
  const host = process.env.TRIPVAULT_HOST || process.env.HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
  const port = Number(process.env.PORT || process.env.TRIPVAULT_PORT || "8788");
  const origin = new URL(process.env.TRIPVAULT_ORIGIN || `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`).origin;
  const databasePath = resolve(process.env.TRIPVAULT_DB || resolve(import.meta.dir, "../work/tripvault-rooms.sqlite3"));
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  const api = createRoomApi({ database: db, origin });
  const page = Bun.file(resolve(import.meta.dir, LOCAL_HTML));
  if (!await page.exists())
    throw new Error(`Place ${LOCAL_HTML} next to this server file.`);
  const server = Bun.serve({
    hostname: host,
    port,
    maxRequestBodySize: 16384,
    fetch(request, listener) {
      const path = new URL(request.url).pathname;
      if (path.startsWith("/api/"))
        return api(request, listener.requestIP(request)?.address || "local");
      if (request.method === "GET" && (path === "/" || path === "/" + LOCAL_HTML)) {
        return new Response(Bun.file(resolve(import.meta.dir, LOCAL_HTML)), { headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer"
        } });
      }
      return new Response("Page unavailable.", { status: 404 });
    }
  });
  console.log(`TripVault Rooms: ${origin} (listening on ${host}:${server.port})`);
}
export {
  createRoomApi
};

/**
 * Resolve an optional CLI address parameter against a fallback.
 *
 * Only an OMITTED parameter (`undefined`) defers to `resolveFallback` — a
 * saved deployment record, the protocol's own pointer, whatever the caller's
 * own lookup does. A parameter the caller actually supplied is validated as
 * an address and used as-is, and never falls back: an empty string (the
 * shape an unset shell variable interpolated into a wrapper script's
 * `--controller "$VAR"` takes) or a malformed one is refused outright rather
 * than silently resolving to whatever the fallback would have found.
 *
 * Shared by every task that resolves `--controller`/`--multisig` so the same
 * omitted-vs-empty distinction cannot drift between call sites.
 */
const resolveOptionalAddress = async (hreEthers, value, resolveFallback) => {
    if (value === undefined) {
        return resolveFallback();
    }
    if (!hreEthers.utils.isAddress(value)) {
        throw new Error(`'${value}' is not a valid address`);
    }
    return hreEthers.utils.getAddress(value);
};

module.exports = { resolveOptionalAddress };

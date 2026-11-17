// Resolve the extensionless local imports used by the Convex source when running
// its tests directly with Node 22's built-in TypeScript support.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
      try {
        return await nextResolve(`${specifier}.ts`, context);
      } catch (typescriptError) {
        if (typescriptError.code !== "ERR_MODULE_NOT_FOUND") throw typescriptError;
        return nextResolve(`${specifier}.js`, context);
      }
    }
    throw error;
  }
}

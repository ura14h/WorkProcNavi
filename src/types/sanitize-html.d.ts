declare module "sanitize-html" {
  type SimpleTransformAttributes = Record<string, string>;

  type SanitizeHtmlOptions = {
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
    allowedSchemes?: string[];
    transformTags?: Record<string, unknown>;
  };

  function sanitizeHtml(dirty: string, options?: SanitizeHtmlOptions): string;

  namespace sanitizeHtml {
    function simpleTransform(
      newTagName: string,
      newAttributes?: SimpleTransformAttributes,
    ): unknown;
  }

  export default sanitizeHtml;
}

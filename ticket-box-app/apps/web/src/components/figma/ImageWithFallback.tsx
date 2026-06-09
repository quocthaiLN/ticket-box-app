import { useState } from "react";

const ERROR_IMG_SRC =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSIjMDAwIiBzdHJva2U9IiM4NTg1QTAiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIG9wYWNpdHk9Ii42IiBmaWxsPSJub25lIiBzdHJva2Utd2lkdGg9IjMuNyI+PHJlY3QgeD0iMTYiIHk9IjE2IiB3aWR0aD0iNTYiIGhlaWdodD0iNTYiIHJ4PSI2Ii8+PHBhdGggZD0ibTE2IDU4IDE2LTE4IDMyIDMyIi8+PGNpcmNsZSBjeD0iNTMiIGN5PSIzNSIgcj0iNyIvPjwvc3ZnPg==";

export function ImageWithFallback(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [didError, setDidError] = useState(false);
  const { src, alt, style, className, ...rest } = props;

  if (didError || !src) {
    return (
      <div
        className={`inline-block bg-[#111118] text-center align-middle ${className ?? ""}`}
        style={style}
      >
        <div className="flex h-full w-full items-center justify-center">
          <img src={ERROR_IMG_SRC} alt="Image unavailable" {...rest} />
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      {...rest}
      onError={() => setDidError(true)}
    />
  );
}


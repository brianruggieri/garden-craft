import React from "react";

type CatalogStatusBannerProps = {
  catalogLoading: boolean;
  catalogError: string | null;
};

const CatalogStatusBanner: React.FC<CatalogStatusBannerProps> = ({
  catalogLoading,
  catalogError,
}) => (
  <>
    {catalogLoading && (
      <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs font-bold px-4 py-2">
        Loading plant catalog...
      </div>
    )}
    {catalogError && (
      <div className="bg-red-50 border-b border-red-200 text-red-700 text-xs font-bold px-4 py-2">
        {catalogError}
      </div>
    )}
  </>
);

export default CatalogStatusBanner;

interface SalesCRMLayoutProps {
  children: React.ReactNode;
}

/**
 * CRM content shell. Navigation, top bar and banner are global (see __root).
 */
const SalesCRMLayout = ({ children }: SalesCRMLayoutProps) => {
  return (
    <div className="min-h-full w-full">
      <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
};

export default SalesCRMLayout;

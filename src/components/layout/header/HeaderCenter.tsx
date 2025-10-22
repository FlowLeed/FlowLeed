interface HeaderCenterProps {
  children: React.ReactNode;
}

export const HeaderCenter = ({ children }: HeaderCenterProps) => {
  return (
    <div className="flex-1 flex justify-center items-center px-4">
      {children}
    </div>
  );
};

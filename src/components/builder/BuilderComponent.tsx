import React from 'react';
import { BuilderComponent as BC, builder } from '@builder.io/react';
import '@builder.io/react/dist/lib/builder.css';

interface BuilderComponentProps {
  modelName: string;
  content?: any;
}

export const BuilderComponent: React.FC<BuilderComponentProps> = ({ 
  modelName, 
  content 
}) => {
  return (
    <BC
      model={modelName}
      content={content}
    />
  );
};

// Register custom components if needed
builder.init('f79f51d17d3a44f5af10f6b2af8e0e2f');
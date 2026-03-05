import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { format } from 'date-fns';
import { useAppStore } from '../stores/appStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.example.com/';

interface QRContainerProps {
  classType?: string;
}

const QRContainer: React.FC<QRContainerProps> = ({ classType }) => {
  const { clubName, token } = useAppStore();
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const [isLoading, setIsLoading] = useState(true);
  const [formattedValueQr, setFormattedValueQr] = useState('');
  const [hasError, setHasError] = useState(false);

  // Function to clean the type value by removing special characters
  const cleanTypeValue = (type: string | undefined): string => {
    if (!type) return '';
    // Remove all special characters and keep only alphanumeric characters
    return type.replace(/[^a-zA-Z0-9]/g, '');
  };

  const getInfoBranch = async () => {
    try {
      setIsLoading(true);
      setHasError(false);

      const type = cleanTypeValue(classType);

      if (!token || !clubName || !type) {
        console.error('Missing required data for QR generation');
        setHasError(true);
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}v1/branches`, {
        method: 'GET',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const dataJson = await response.json();

      if (!dataJson.result || !Array.isArray(dataJson.result)) {
        throw new Error('Invalid API response format');
      }

      const currentDate = new Date();
      const formattedDate = format(currentDate, "yyyy'-'MM'-'dd");
      const filterBranch = dataJson.result.filter(
        (branch: any) => branch.name === clubName
      );

      if (filterBranch.length === 0) {
        throw new Error(`Branch ${clubName} not found`);
      }

      const branch = filterBranch[0];

      if (branch.country_code === 'ES') {
        // For Spanish branches, don't show QR
        setIsLoading(true);
      } else {
        // Validate that we have the required data
        if (!branch.evo_token) {
          throw new Error('Missing evo_token for branch');
        }

        const qrValue = `${type},${formattedDate},${branch.evo_token}`;

        // Ensure QR value is not empty
        if (qrValue.length < 10) {
          throw new Error('QR value too short');
        }

        setFormattedValueQr(qrValue);
        setIsLoading(false);
        retryCountRef.current = 0; // Reset retry count on success
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      retryCountRef.current += 1;

      if (retryCountRef.current < maxRetries) {
        // Retry after a delay
        setTimeout(() => {
          console.log(
            `Retrying QR generation (attempt ${retryCountRef.current + 1}/${maxRetries})`
          );
          getInfoBranch();
        }, 2000 * retryCountRef.current); // Exponential backoff
      } else {
        // Max retries reached, show error state
        setHasError(true);
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    getInfoBranch();

    // Set up periodic refresh every 5 minutes to ensure QR stays valid
    const refreshInterval = setInterval(() => {
      if (!hasError) {
        getInfoBranch();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(refreshInterval);
  }, [classType, clubName]);

  // Don't render anything if loading or has error
  if (isLoading || hasError || !formattedValueQr) {
    return null;
  }

  return (
    <div>
      <QRCode
        size={256}
        style={{ height: 'auto', maxWidth: '99%', width: '99%' }}
        value={formattedValueQr}
        viewBox="0 0 256 256"
      />
    </div>
  );
};

export { QRContainer };

import React from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import { Icon, MultiColumnList } from '@folio/stripes/components';
import STATUS from '../scanStatus';

const scanFormatter = { status: scan => {
  if (scan.status === STATUS.SUCCESS) {
    return <Icon size="large" icon="check-circle" status="success" />;
  }
  if (scan.status === STATUS.FAIL) {
    return <Icon size="large" icon="times-circle-solid" status="error" />;
  }
  return <Icon size="large" icon="clock" />;
} };

const ScanList = ({ scans, scanData, selectedScan, onRowClick }) => {
  const formattedScans = scans.map(scannedAt => {
    const scan = scanData[scannedAt];
    return {
      status: scan?.status ?? '',
      hrid: scan?.hrid ?? '',
      requester: scan?.request?.requestingInstitutionSymbol ?? '',
      supplier: scan?.request?.supplyingInstitutionSymbol ?? '',
      title: scan?.request?.title ?? '',
      scannedAt,
    };
  });

  return (
    <MultiColumnList
      contentData={formattedScans}
      formatter={scanFormatter}
      visibleColumns={['status', 'hrid', 'requester', 'supplier', 'title']}
      isSelected={({ item }) => selectedScan === item.scannedAt}
      onRowClick={onRowClick}
      columnMapping={{
        status: '',
        hrid: <FormattedMessage id="ui-update.column.hrid" />,
        requester: <FormattedMessage id="ui-update.column.requester" />,
        supplier: <FormattedMessage id="ui-update.column.supplier" />,
        title: <FormattedMessage id="ui-update.column.title" />
      }}
      // It would be better to express the fixed-width columns in em and let
      // the remaining space go to Title, alas there seems to be an MCL bug
      // preventing this. Adding up to less than 100% is necessary to avoid
      // scrollbars introduced by some negative margin somewhere.
      columnWidths={{
        status: { max: 40 },
        hrid: { max: 100 },
        requester: { min: 140 },
        supplier: { min: 140 },
      }}
    />
  );
};

ScanList.propTypes = {
  scans: PropTypes.arrayOf(PropTypes.number),
  scanData: PropTypes.object.isRequired,
  selectedScan: PropTypes.number.isRequired,
  onRowClick: PropTypes.func.isRequired,
};

export default ScanList;

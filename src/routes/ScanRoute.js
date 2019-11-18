import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import { Form, Field } from 'react-final-form';
import _ from 'lodash';
import classNames from 'classnames';
import { Layout, Row, Col, Select, TextField, MultiColumnList, Card, Icon } from '@folio/stripes/components';
import { stripesConnect } from '@folio/stripes/core';
import css from './ScanRoute.css';

const scanFormatter = { success: scan => {
  if (scan.success === true) {
    return <Icon size="large" icon="check-circle" status="success" />;
  }
  if (scan.success === false) {
    return <Icon size="large" icon="times-circle-solid" status="error" />;
  }
  return <Icon size="large" icon="clock" />;
} };

const ScanRoute = props => {
  // Unfortunately, it doesn't seem to be readily possible to initialise at the field level.
  // So either we put the initial status here and always get that value even when the control
  // is invisible, or we exclude it and don't get a value for status when the default is accepted
  // and not explicitly chosen.
  const initialValues = {
    op: 'changeStatus',
    status: 'received',
  };
  const [selScan, setSelScan] = useState(null);
  const [scans, setScans] = useState([]);
  const [scanData, setScanData] = useState({});

  const onSubmit = (values, form) => {
    const scannedAt = Date.now();
    form.initialize(_.omit(values, 'reqId'));

    // scannedAt functions as the id of the scan rather than reqId, enabling
    // one to scan an item multiple times and see past statuses
    setScanData({ ...scanData, [scannedAt]: null });
    setSelScan(scannedAt);
    setScans([{ scannedAt, ...values }, ...scans]);
    props.mutator.request
      .GET({ path: `rs/patronrequests/${values.reqId}` })
      .then(res => setScanData(prevData => ({ ...prevData, [scannedAt]: res })));
  };

  const formattedScans = scans.map(scan => {
    const data = scanData[scan.scannedAt];
    if (!data) {
      return { success: null, reqId: scan.reqId, requester: '', supplier: '', title: '' };
    }
    const mayGet = prop => _.get(data, prop, '');
    console.log(scan, data);
    return {
      success: true,
      reqId: scan.reqId,
      requester: mayGet('requestingInstitutionSymbol'),
      supplier: mayGet('supplyingInstitutionSymbol'),
      title: mayGet('title'),
      scannedAt: scan.scannedAt,
    };
  });

  return (
    <Layout className="padding-all-gutter">
      <Row>
        <Col xs={8}>
          <Form
            onSubmit={onSubmit}
            initialValues={initialValues}
            render={({ handleSubmit, form, values }) => (
              <form onSubmit={handleSubmit}>
                <Row>
                  <Col xs={6}>
                    <Field name="op" component={Select} required>
                      {['changeStatus', 'slip'].map(trKey => (
                        <FormattedMessage key={trKey} id={`ui-scan.op.${trKey}`}>
                          {trMsg => <option value={trKey}>{trMsg}</option>}
                        </FormattedMessage>
                      ))}
                    </Field>
                  </Col>
                  <Col xs={6}>
                    {values.op === 'changeStatus' && (
                      <Field name="status" component={Select} required>
                        {['received', 'sent'].map(trKey => (
                          <FormattedMessage key={trKey} id={`ui-scan.status.${trKey}`}>
                            {trMsg => <option value={trKey}>{trMsg}</option>}
                          </FormattedMessage>
                        ))}
                      </Field>
                    )}
                  </Col>
                </Row>
                <Field name="reqId" component={TextField} autoFocus placeholder="Scan or enter barcode..." />
              </form>
            )}
          />
          {formattedScans.length > 0 &&
            <MultiColumnList
              contentData={formattedScans}
              formatter={scanFormatter}
              visibleColumns={['success', 'reqId', 'requester', 'supplier', 'title']}
              isSelected={({ item }) => selScan === item.scannedAt}
              onRowClick={(e, row) => setSelScan(row.scannedAt)}
              columnMapping={{
                success: '',
                reqId: <FormattedMessage id="ui-scan.column.reqId" />,
                requester: <FormattedMessage id="ui-scan.column.requester" />,
                supplier: <FormattedMessage id="ui-scan.column.supplier" />,
                title: <FormattedMessage id="ui-scan.column.title" />
              }}
              // It would be better to express the fixed-width columns in em and let
              // the remaining space go to Title, alas there seems to be an MCL bug
              // preventing this. Adding up to less than 100% is necessary to avoid
              // scrollbars introduced by some negative margin somewhere.
              columnWidths={{
                success: '5%',
                reqId: '30%',
                requester: '10%',
                supplier: '10%',
                title: '44%',
              }}
            />
          }
        </Col>
        <Col xs={4}>
          {selScan === null && 'Scan an item!'}
          {selScan && !scanData[selScan] && 'Loading...'}
          {selScan && scanData[selScan] && (
            <Card roundedBorder headerStart="Item" headerEnd="View">
              {_.get(scanData, [selScan, 'title'])}
            </Card>
          )}
        </Col>
      </Row>
    </Layout>
  );
};

ScanRoute.manifest = {
  request: {
    type: 'okapi',
    fetch: false,
    accumulate: true,
  },
};

ScanRoute.propTypes = {
  mutator: PropTypes.object.isRequired,
};

export default stripesConnect(ScanRoute);

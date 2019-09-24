import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import { Form, Field } from 'react-final-form';
import _ from 'lodash';
import classNames from 'classnames';
import { Layout, Row, Col, Select, TextField, List, Card } from '@folio/stripes/components';
import { stripesConnect } from '@folio/stripes/core';
import css from './ScanRoute.css';

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
  return (
    <Row>
      <Col xs={8}>
        <Layout className="padding-all-gutter">
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
          <List
            items={scans}
            itemFormatter={req => {
              const mayGet = prop => _.get(scanData[req.scannedAt], prop, '');
              return (
                <button
                  type="button"
                  onClick={() => setSelScan(req.scannedAt)}
                  key={req.scannedAt}
                  className={css.scanned}
                >
                  <Card
                    cardStyle="positive"
                    cardClass={classNames({ [css.selected]: req.scannedAt === selScan })}
                    roundedBorder
                    headerStart={mayGet('title') || req.reqId}
                  >
                    {mayGet('isRequester') ? 'Loan' : 'Return'}
                  </Card>
                </button>
              );
            }}
          />
        </Layout>
      </Col>
      <Col xs={4}>
        <Layout className="padding-all-gutter">
          {selScan === null && 'Scan an item!'}
          {selScan && !scanData[selScan] && 'Loading...'}
          {selScan && scanData[selScan] && (
            <Card roundedBorder headerStart="Item" headerEnd="View">
              {_.get(scanData, [selScan, 'title'])}
            </Card>
          )}
        </Layout>
      </Col>
    </Row>
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
